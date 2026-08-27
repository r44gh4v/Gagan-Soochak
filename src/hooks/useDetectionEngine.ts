"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CLASS_LABELS } from "@/lib/detection/constants";
import { captureEvidence } from "@/lib/detection/frameCapture";
import { HazardTracker, type TrackedHazard } from "@/lib/detection/tracker";
import type { WorkerResponse } from "@/lib/model/types";
import { useIncidentStore, type DetectionContext } from "@/store/incidents";
import { useSessionStore } from "@/store/session";
import { useModelLoader } from "@/hooks/useModelLoader";

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
  const runningRef = useRef(false);

  const [ticker, setTicker] = useState<LiveDetection[]>([]);

  const createIncident = useCallback(
    async (hazard: TrackedHazard, ctx: DetectionContext, video: HTMLVideoElement) => {
      try {
        const evidence = await captureEvidence(video, hazard);
        const id = await useIncidentStore
          .getState()
          .createFromHazard(hazard, ctx, evidence);
        hazard.incidentId = id;
        useSessionStore.getState().recordIncident();
        const inc = useIncidentStore.getState().incidents[id];
        toast(`${id} - ${CLASS_LABELS[hazard.className]}`, {
          description: `${inc.severityLevel} · ${inc.location.landmark}`,
        });
        // A hazard that is High on its very first frame lands in created AND
        // highAlerts of the same tracker update; the highAlerts loop skipped
        // it because incidentId was still null. Replay the one-time alert now
        // (alerted=true with a just-set id can only mean it was swallowed).
        if (hazard.alerted) {
          useIncidentStore.getState().markHighAlert(id);
          toast.error(`HIGH severity - ${CLASS_LABELS[hazard.className]}`, {
            id: `high-${id}`,
            description: `${id} · severity ${hazard.severity.score.toFixed(2)}`,
          });
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
          toast.error(`HIGH severity - ${CLASS_LABELS[hazard.className]}`, {
            id: `high-${hazard.incidentId}`,
            description: `${hazard.incidentId} · severity ${hazard.severity.score.toFixed(2)}`,
          });
        }
      }
    },
    [videoRef, createIncident],
  );

  const init = useCallback(
    () => initWorker(handleResult),
    [initWorker, handleResult],
  );

  // Frame loop - requestVideoFrameCallback ties us to decoded frames.
  const loop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !runningRef.current) return;

    const onFrame = () => {
      if (!runningRef.current || !videoRef.current) return;
      const v = videoRef.current;
      const s = useSessionStore.getState();

      frameIdxRef.current++;
      const shouldProcess =
        s.model.phase === "ready" && // never post infer before init completes
        frameIdxRef.current % s.skipN === 0 &&
        !busyRef.current &&
        !v.paused &&
        v.videoWidth > 0;
      s.recordFrame(shouldProcess);

      if (shouldProcess && workerRef.current) {
        busyRef.current = true;
        createImageBitmap(v)
          .then((bitmap) => {
            workerRef.current?.postMessage(
              { type: "infer", id: ++reqSeqRef.current, bitmap, conf: s.confThreshold },
              [bitmap],
            );
          })
          .catch(() => {
            busyRef.current = false;
          });
      }

      // draw persisted boxes on EVERY frame
      drawOverlay(trackerRef.current.active);
      rafHandleRef.current = v.requestVideoFrameCallback(onFrame);
    };

    rafHandleRef.current = video.requestVideoFrameCallback(onFrame);
  }, [videoRef, drawOverlay, workerRef]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    loop();
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    const video = videoRef.current;
    if (video && rafHandleRef.current) {
      video.cancelVideoFrameCallback(rafHandleRef.current);
    }
  }, [videoRef]);

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
