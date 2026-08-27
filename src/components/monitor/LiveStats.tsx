"use client";

import { effectiveFps, useSessionStore } from "@/store/session";

export function LiveStats() {
  const perf = useSessionStore((s) => s.perf);
  const model = useSessionStore((s) => s.model);

  const avgMs =
    perf.framesProcessed > 0 ? perf.inferenceMsTotal / perf.framesProcessed : 0;

  const stats: [string, string][] = [
    ["Inference", perf.inferenceMsLast ? `${Math.round(perf.inferenceMsLast)} ms` : "—"],
    ["Avg", avgMs ? `${Math.round(avgMs)} ms` : "—"],
    ["Effective FPS", effectiveFps(perf) ? effectiveFps(perf).toFixed(1) : "—"],
    ["Frames processed", String(perf.framesProcessed)],
    ["Detections", String(perf.detections)],
    ["Incidents", String(perf.incidentsCreated)],
    [
      "Backend",
      model.phase === "ready" ? (model.backend === "webgpu" ? "WebGPU" : "WASM") : "—",
    ],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {stats.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="text-xs font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
