"use client";

import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSessionStore } from "@/store/session";

const fmtMB = (b: number) => (b / 1024 / 1024).toFixed(1);

/**
 * Blocks the monitor until the on-device model is ready. The download IS a
 * demo beat — it proves inference happens on the operator's machine.
 */
export function ModelGate({ onRetry }: { onRetry: () => void }) {
  const model = useSessionStore((s) => s.model);

  if (model.phase === "ready") return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/95 p-8 text-center">
      {model.phase === "error" ? (
        <>
          <ShieldAlert className="size-8 text-red-600" />
          <div className="text-sm font-medium">Model failed to load</div>
          <div className="max-w-sm text-sm text-muted-foreground">
            {model.message}. Check the network connection — the model downloads
            once (~12 MB) and is cached for offline use afterwards.
          </div>
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <div className="text-sm font-medium">Loading on-device detection model</div>
          {model.phase === "downloading" ? (
            <>
              <Progress
                value={model.total ? (model.received / model.total) * 100 : 0}
                className="w-64"
              />
              <div className="text-xs tabular-nums text-muted-foreground">
                {fmtMB(model.received)} / {model.total ? fmtMB(model.total) : "?"} MB
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              {model.phase === "compiling" ? "Compiling for this device…" : "Checking cache…"}
            </div>
          )}
          <div className="max-w-xs text-xs text-muted-foreground">
            The model runs entirely in your browser. Nothing is uploaded.
          </div>
        </>
      )}
    </div>
  );
}
