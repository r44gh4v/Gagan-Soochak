"use client";

import { FileVideo } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DetectionTicker } from "@/components/monitor/DetectionTicker";
import { LiveStats } from "@/components/monitor/LiveStats";
import { ModelGate } from "@/components/monitor/ModelGate";
import { RunControls } from "@/components/monitor/RunControls";
import { SourcePicker, type VideoSource } from "@/components/monitor/SourcePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASS_LABELS, SEVERITY_STROKE } from "@/lib/detection/constants";
import type { TrackedHazard } from "@/lib/detection/tracker";
import { SAMPLE_CLIPS } from "@/lib/mock/clips";
import { useDetectionEngine } from "@/hooks/useDetectionEngine";
import { useSessionStore } from "@/store/session";

// A judge landing cold should be one click (Play) from a working demo -
// preselect the first bundled clip instead of showing an empty stage.
const DEFAULT_SOURCE: VideoSource = {
  url: SAMPLE_CLIPS[0].src,
  label: SAMPLE_CLIPS[0].file,
  routeId: SAMPLE_CLIPS[0].routeId,
  isUpload: false,
};

export default function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<VideoSource | null>(DEFAULT_SOURCE);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [videoError, setVideoError] = useState<string | null>(null);

  const setRouteId = useSessionStore((s) => s.setRouteId);
  const setSourceLabel = useSessionStore((s) => s.setSourceLabel);
  const modelPhase = useSessionStore((s) => s.model.phase);

  // Overlay: boxes drawn in intrinsic video px on EVERY frame. Both <video>
  // and <canvas> use object-contain in the same box, so their rendered content
  // rects match and the coordinates never drift.
  const drawOverlay = useCallback((hazards: TrackedHazard[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const fontPx = Math.max(14, Math.round(canvas.width / 45));
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));

    for (const h of hazards) {
      const [x1, y1, x2, y2] = h.bbox;
      const stroke = SEVERITY_STROKE[h.severity.level];
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = `${CLASS_LABELS[h.className]} ${h.confidence.toFixed(2)} · ${h.severity.level}`;
      const tw = ctx.measureText(label).width;
      const ly = Math.max(fontPx + 8, y1);
      ctx.fillStyle = stroke;
      ctx.fillRect(x1, ly - fontPx - 8, tw + 12, fontPx + 10);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x1 + 6, ly - 5);
    }
  }, []);

  const { init, start, stop, reset, ticker } = useDetectionEngine(videoRef, drawOverlay);

  useEffect(() => {
    void init();
    // sync session context with the preselected default clip
    setRouteId(DEFAULT_SOURCE.routeId);
    setSourceLabel(DEFAULT_SOURCE.label);
  }, [init, setRouteId, setSourceLabel]);

  const selectSource = (src: VideoSource) => {
    reset();
    setVideoError(null);
    setSource((prev) => {
      // release the previous upload's blob URL
      if (prev?.isUpload) URL.revokeObjectURL(prev.url);
      return src;
    });
    setRouteId(src.routeId);
    setSourceLabel(src.label);
    setPlaying(false);
    setTime({ current: 0, duration: 0 });
  };

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const handleReset = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    reset();
  };

  return (
    // Locked to the viewport under the 3.5rem header: the video flexes to the
    // space left over, so playback controls are always on screen.
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 p-4">
      <SourcePicker current={source} onSelect={selectSource} />

      {/* video column : rail = 2 : 1 */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3">
          {/* Stage fills the column; clips of any aspect letterbox inside it. */}
          <div className="flex min-h-0 flex-1">
            <div className="relative h-full w-full overflow-hidden rounded-lg border bg-zinc-950">
            {source && (
              <>
                <video
                  key={source.url}
                  ref={videoRef}
                  src={source.url}
                  className="h-full w-full object-contain"
                  playsInline
                  muted
                  onPlay={() => {
                    setPlaying(true);
                    start();
                  }}
                  onPause={() => {
                    setPlaying(false);
                    stop();
                  }}
                  onEnded={() => {
                    setPlaying(false);
                    stop();
                  }}
                  onTimeUpdate={(e) =>
                    setTime({
                      current: e.currentTarget.currentTime,
                      duration: e.currentTarget.duration || 0,
                    })
                  }
                  onLoadedMetadata={(e) => {
                    setVideoError(null);
                    setTime({ current: 0, duration: e.currentTarget.duration || 0 });
                  }}
                  onError={(e) => {
                    // Without this the stage just goes black and the operator
                    // has no idea the browser could not decode their file.
                    const err = e.currentTarget.error;
                    setPlaying(false);
                    stop();
                    setVideoError(
                      err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                        ? "This browser can't decode that video. Chrome plays H.264/VP9/AV1 in .mp4 or .webm - HEVC/H.265 (common from iPhones) and some .mov files won't play. Re-encode to H.264 mp4 and try again."
                        : err?.code === MediaError.MEDIA_ERR_DECODE
                          ? "The video failed to decode partway through - the file may be corrupt or truncated."
                          : "The video could not be loaded.",
                    );
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              </>
              )}
              {videoError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/95 p-6 text-center">
                <FileVideo className="size-8 text-muted-foreground" />
                <div className="text-sm font-medium">Can&apos;t play this video</div>
                <p className="max-w-md text-sm text-muted-foreground">{videoError}</p>
              </div>
            )}
            {modelPhase !== "ready" && <ModelGate onRetry={() => void init()} />}
            </div>
          </div>

          <RunControls
            playing={playing}
            currentTime={time.current}
            duration={time.duration}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <Card className="shrink-0 gap-0 py-3">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="text-sm">Session</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <LiveStats />
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col gap-0 py-3">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="text-sm">Live detections</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-4">
              <DetectionTicker items={ticker} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
