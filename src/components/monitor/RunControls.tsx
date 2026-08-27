"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSessionStore } from "@/store/session";

export function RunControls({
  playing,
  currentTime,
  duration,
  onPlayPause,
  onReset,
}: {
  playing: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onReset: () => void;
}) {
  const skipN = useSessionStore((s) => s.skipN);
  const setSkipN = useSessionStore((s) => s.setSkipN);
  const conf = useSessionStore((s) => s.confThreshold);
  const setConf = useSessionStore((s) => s.setConfThreshold);

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPlayPause}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs">Process every Nth frame</Label>
          <span className="text-xs tabular-nums text-muted-foreground">N = {skipN}</span>
        </div>
        <Slider
          min={1}
          max={8}
          step={1}
          value={[skipN]}
          onValueChange={([v]) => setSkipN(v)}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Default 2 matches the edge pipeline - ~12-15 Hz effective sampling.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs">Confidence threshold</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {conf.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0.1}
          max={0.9}
          step={0.05}
          value={[conf]}
          onValueChange={([v]) => setConf(v)}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Edge pipeline runs at 0.30 - permissive by design; the Reject action
          handles the false positives it admits.
        </p>
      </div>
    </div>
  );
}
