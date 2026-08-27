"use client";

import { MonitorPlay } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DetectionTicker } from "@/components/monitor/DetectionTicker";
import { LiveStats } from "@/components/monitor/LiveStats";
import { ModelGate } from "@/components/monitor/ModelGate";
import { RunControls } from "@/components/monitor/RunControls";
import { SourcePicker, type VideoSource } from "@/components/monitor/SourcePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CLASS_LABELS,
  SEVERITY_STROKE,
} from "@/lib/detection/constants";
import type { TrackedHazard } from "@/lib/detection/tracker";
import { useDetectionEngine } from "@/hooks/useDetectionEngine";
import { useSessionStore } from "@/store/session";

export default function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });

  const setRouteId = useSessionStore((s) => s.setRouteId);
  const setSourceLabel = useSessionStore((s) => s.setSourceLabel);
  const modelPhase = useSessionStore((s) => s.model.phase);

  // Overlay: boxes drawn in intrinsic video px on EVERY frame; the canvas is
  // CSS-stretched over the video so coordinates never drift.
  const drawOverlay = useCallback((hazards: TrackedHazard[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const fontPx = Math.max(12, Math.round(canvas.width / 55));
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 320));

    for (const h of hazards) {
      const [x1, y1, x2, y2] = h.bbox;
      const stroke = SEVERITY_STROKE[h.severity.level];
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = `${CLASS_LABELS[h.className]} ${h.confidence.toFixed(2)} · ${h.severity.level}`;
      const tw = ctx.measureText(label).width;
      const ly = Math.max(fontPx + 6, y1);
      ctx.fillStyle = stroke;
      ctx.fillRect(x1, ly - fontPx - 6, tw + 10, fontPx + 8);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x1 + 5, ly - 4);
    }
  }, []);

  const { init, start, stop, reset, ticker } = useDetectionEngine(videoRef, drawOverlay);

  useEffect(() => {
    void init();
  }, [init]);

  const selectSource = (src: VideoSource) => {
    reset();
    setSource(src);
    setRouteId(src.routeId);
    setSourceLabel(src.label);
    setPlaying(false);
  };

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const handleReset = () => {
    const v = videoRef.current;
    if (v) v.currentTime = 0;
    reset();
  };

  return (
    <div className="space-y-4">
      <SourcePicker current={source} onSelect={selectSource} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <Card className="overflow-hidden py-0">
          <div className="relative bg-zinc-950">
            {source ? (
              <>
                <video
                  ref={videoRef}
                  src={source.url}
                  className="block max-h-[70vh] w-full object-contain"
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
                  onLoadedMetadata={(e) =>
                    setTime({ current: 0, duration: e.currentTarget.duration || 0 })
                  }
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
                <MonitorPlay className="size-8 text-zinc-600" />
                <p className="text-sm text-zinc-400">
                  Pick a sample clip or drop an .mp4 to start detecting
                </p>
              </div>
            )}
            {source && modelPhase !== "ready" && <ModelGate onRetry={() => void init()} />}
          </div>
          {source && (
            <CardContent className="border-t py-3">
              <RunControls
                playing={playing}
                currentTime={time.current}
                duration={time.duration}
                onPlayPause={handlePlayPause}
                onReset={handleReset}
              />
            </CardContent>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Session</CardTitle>
            </CardHeader>
            <CardContent>
              <LiveStats />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detections (live)</CardTitle>
            </CardHeader>
            <CardContent>
              <DetectionTicker items={ticker} />
              <Separator className="my-3" />
              <p className="text-[11px] leading-snug text-muted-foreground">
                New hazards become incidents in the Queue automatically —
                logged at first sight at whatever severity they start at.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
