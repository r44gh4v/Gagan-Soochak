"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionStore } from "@/store/session";

const fmt = (t: number) => {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** One compact row so playback + tuning always sit under the video, no scroll. */
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

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2">
      <Button size="sm" onClick={onPlayPause} className="w-24">
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? "Pause" : "Play"}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8" onClick={onReset}>
            <RotateCcw className="size-4" />
            <span className="sr-only">Reset playback and tracker</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Restart clip &amp; clear tracker</TooltipContent>
      </Tooltip>

      <span className="text-xs tabular-nums text-muted-foreground">
        {fmt(currentTime)} / {fmt(duration)}
      </span>

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      <div className="flex min-w-44 flex-1 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className="cursor-help whitespace-nowrap text-xs text-muted-foreground">
              Every Nth frame
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            Matches the edge pipeline (N=2, ~12-15 Hz effective sampling)
          </TooltipContent>
        </Tooltip>
        <Slider
          min={1}
          max={8}
          step={1}
          value={[skipN]}
          onValueChange={([v]) => setSkipN(v)}
          className="flex-1"
        />
        <span className="w-4 text-xs tabular-nums">{skipN}</span>
      </div>

      <div className="flex min-w-44 flex-1 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className="cursor-help whitespace-nowrap text-xs text-muted-foreground">
              Confidence
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            Edge pipeline runs at 0.30 - permissive by design; Reject handles
            the false positives it admits
          </TooltipContent>
        </Tooltip>
        <Slider
          min={0.1}
          max={0.9}
          step={0.05}
          value={[conf]}
          onValueChange={([v]) => setConf(v)}
          className="flex-1"
        />
        <span className="w-8 text-xs tabular-nums">{conf.toFixed(2)}</span>
      </div>
    </div>
  );
}
