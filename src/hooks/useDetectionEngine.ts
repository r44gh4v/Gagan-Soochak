"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RESIZE_DIM } from "@/lib/detection/constants";
import { captureEvidence } from "@/lib/detection/frameCapture";
import { HazardTracker, type TrackedHazard } from "@/lib/detection/tracker";
import type { WorkerResponse } from "@/lib/model/types";
import { useIncidentStore, type DetectionContext } from "@/store/incidents";
import { useSessionStore } from "@/store/session";
import { useModelLoader } from "@/hooks/useModelLoader";

/** ~30 Hz base tick; skipN divides it (N=2 -> ~15 Hz, matching the edge pipeline). */
const SAMPLE_INTERVAL_MS = 1000 / 30;

export type LiveDetection = {
  key: string;
  className: string;
  confidence: number;
  level: string;
  at: number;
};

/**
 * The full client-side pipeline: video frames → worker inference (every Nth
 * frame, one in-flight request, drop while busy) → HazardTracker → incident
 * store. The overlay draws tracker.active on EVERY frame via the consumer's
 * draw callback, so boxes persist across skipped frames without flicker.
 */
export function useDetectionEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  drawOverlay: (hazards: TrackedHazard[]) => void,
) {
  const { init: initWorker, workerRef } = useModelLoader();
  const trackerRef = useRef(new HazardTracker());
  const busyRef = useRef(false);
  const frameIdxRef = useRef(0);
  const processedIdxRef = useRef(0);
  const reqSeqRef = useRef(0);
  const rafHandleRef = useRef(0);
  const intervalRef = useRef(0);
  const runningRef = useRef(false);

  const [ticker, setTicker] = useState<LiveDetection[]>([]);

  const createIncident = useCallback(
    async (hazard: TrackedHazard, ctx: DetectionContext, video: HTMLVideoElement) => {
      try {
        const evidence = await captureEvidence(video, hazard);
        const { id, merged } = await useIncidentStore
          .getState()
          .createFromHazard(hazard, ctx, evidence);
        hazard.incidentId = id;
        if (merged) useSessionStore.getState().recordMergedSighting();
        else useSessionStore.getState().recordIncident();
        // Detections are surfaced in the Monitor's live rail and the Queue,
        // not as toasts - a busy clip would otherwise bury the screen in them.
        // A hazard that is High on its very first frame lands in created AND
        // highAlerts of the same tracker update; the highAlerts loop skipped
        // it because incidentId was still null. Record the alert now
        // (alerted=true with a just-set id can only mean it was swallowed).
        if (hazard.alerted) {
          useIncidentStore.getState().markHighAlert(id);
          useSessionStore.getState().recordHighAlert();
        }
      } catch (err) {
        console.error("incident creation failed", err);
      }
    },
    [],
  );

  // Worker responses: tracker update + incident writes + evidence capture.
  const handleResult = useCallback(
    (msg: WorkerResponse) => {
      if (msg.type === "error") {
        // Without this, one failed inference leaves busyRef stuck true and
        // detection silently halts for the rest of the session.
        busyRef.current = false;
        return;
      }
      if (msg.type !== "result") return;
      busyRef.current = false;
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const s = useSessionStore.getState();
      s.recordInference(msg.inferenceMs, msg.detections.length);

      const update = trackerRef.current.update(
        msg.detections,
        processedIdxRef.current++,
        msg.srcW,
        msg.srcH,
        video.currentTime,
      );

      if (msg.detections.length) {
        setTicker((prev) =>
          [
            ...msg.detections.map((d, i) => ({
              key: `${Date.now()}-${i}`,
              className: d.className,
              confidence: d.confidence,
              level:
                update.active.find((h) => h.bbox === d.bbox)?.severity.level ?? "Low",
              at: Date.now(),
            })),
            ...prev,
          ].slice(0, 30),
        );
      }

      const ctx: DetectionContext = {
        routeId: s.routeId,
        patrolStartIso: s.patrolStartIso,
        videoTimeSec: video.currentTime,
        videoDurationSec: Number.isFinite(video.duration) ? video.duration : 0,
        sourceLabel: s.sourceLabel || "uploaded clip",
        frameW: msg.srcW,
        frameH: msg.srcH,
      };

      for (const hazard of update.created) {
        void createIncident(hazard, ctx, video);
      }
      for (const hazard of update.levelChanged) {
        if (hazard.incidentId) {
          useIncidentStore
            .getState()
            .updateSeverity(
              hazard.incidentId,
              hazard.severity.score,
              hazard.severity.level,
              { spatial: hazard.severity.spatial, temporal: hazard.severity.temporal },
              hazard.consecutiveCount,
            );
        }
      }
      for (const hazard of update.highAlerts) {
        if (hazard.incidentId) {
          useIncidentStore.getState().markHighAlert(hazard.incidentId);
          useSessionStore.getState().recordHighAlert();
        }
      }
    },
    [videoRef, createIncident],
  );

  const init = useCallback(
    () => initWorker(handleResult),
    [initWorker, handleResult],
  );

  /**
   * Two loops:
   *
   *  - Sampling (setInterval @ ~30 Hz, process every Nth tick). Deliberately
   *    NOT requestVideoFrameCallback: rVFC only fires when the compositor
   *    actually presents a frame, so a throttled or backgrounded tab starves
   *    it and detection silently stops. A timer gives the documented
   *    ~12-15 Hz effective sampling at N=2 regardless of presentation.
   *  - Overlay (requestAnimationFrame) draws tracker.active every repaint, so
   *    boxes persist smoothly across skipped frames.
   */
  const loop = useCallback(() => {
    const tick = () => {
      const v = videoRef.current;
      if (!runningRef.current || !v) return;
      const s = useSessionStore.getState();

      frameIdxRef.current++;
      const shouldProcess =
        s.model.phase === "ready" && // never post infer before init completes
        frameIdxRef.current % s.skipN === 0 &&
        !busyRef.current &&
        !v.paused &&
        v.videoWidth > 0;
      s.recordFrame(shouldProcess);
      if (!shouldProcess || !workerRef.current) return;

      busyRef.current = true;
      const srcW = v.videoWidth;
      const srcH = v.videoHeight;
      // pipeline.py's stretch-to-640×720 done natively here - far cheaper than
      // drawing a full-resolution frame into a canvas on the main thread.
      createImageBitmap(v, {
        resizeWidth: RESIZE_DIM.w,
        resizeHeight: RESIZE_DIM.h,
        resizeQuality: "medium",
      })
        .then((bitmap) => {
          workerRef.current?.postMessage(
            {
              type: "infer",
              id: ++reqSeqRef.current,
              bitmap,
              conf: s.confThreshold,
              srcW,
              srcH,
            },
            [bitmap],
          );
        })
        .catch(() => {
          busyRef.current = false;
        });
    };

    intervalRef.current = window.setInterval(tick, SAMPLE_INTERVAL_MS);

    const paint = () => {
      if (!runningRef.current) return;
      drawOverlay(trackerRef.current.active);
      rafHandleRef.current = requestAnimationFrame(paint);
    };
    rafHandleRef.current = requestAnimationFrame(paint);
  }, [videoRef, drawOverlay, workerRef]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    loop();
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }
    if (rafHandleRef.current) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = 0;
    }
  }, []);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    frameIdxRef.current = 0;
    processedIdxRef.current = 0;
    busyRef.current = false;
    setTicker([]);
    useSessionStore.getState().resetPerf();
    drawOverlay([]);
  }, [drawOverlay]);

  useEffect(() => stop, [stop]);

  return { init, start, stop, reset, ticker };
}
