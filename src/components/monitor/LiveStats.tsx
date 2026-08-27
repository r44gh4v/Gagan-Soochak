"use client";

import { effectiveFps, useSessionStore } from "@/store/session";

export function LiveStats() {
  const perf = useSessionStore((s) => s.perf);
  const model = useSessionStore((s) => s.model);

  const avgMs =
    perf.framesProcessed > 0 ? perf.inferenceMsTotal / perf.framesProcessed : 0;
  const fps = effectiveFps(perf);

  const stats: [string, string][] = [
    ["Inference", perf.inferenceMsLast ? `${Math.round(perf.inferenceMsLast)} ms` : "-"],
    ["Average", avgMs ? `${Math.round(avgMs)} ms` : "-"],
    ["Sampling", fps ? `${fps.toFixed(1)} Hz` : "-"],
    ["Backend", model.phase === "ready" ? (model.backend === "webgpu" ? "WebGPU" : "WASM") : "-"],
    ["Frames processed", String(perf.framesProcessed)],
    ["Detections", String(perf.detections)],
    ["Incidents", String(perf.incidentsCreated)],
    ["High alerts", String(perf.highAlerts)],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {stats.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
          <dd
            className={
              label === "High alerts" && perf.highAlerts > 0
                ? "text-xs font-semibold tabular-nums text-[#b91c1c]"
                : "text-xs font-medium tabular-nums"
            }
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
