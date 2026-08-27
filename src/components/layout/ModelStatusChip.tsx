"use client";

import { Cpu } from "lucide-react";

import { useSessionStore } from "@/store/session";

export function ModelStatusChip() {
  const model = useSessionStore((s) => s.model);
  const lastMs = useSessionStore((s) => s.perf.inferenceMsLast);

  // The model only loads on /monitor; showing "not loaded" elsewhere reads
  // like a fault rather than "nothing has asked for it yet".
  if (model.phase === "idle") return null;

  let text: string;
  let tone = "text-muted-foreground";
  switch (model.phase) {
    case "downloading": {
      const pct = model.total ? Math.round((model.received / model.total) * 100) : 0;
      text = `Downloading model · ${pct}%`;
      break;
    }
    case "compiling":
      text = "Compiling model…";
      break;
    case "ready":
      text = `Model ready${model.fromCache ? " (cached)" : ""} · ${model.backend === "webgpu" ? "WebGPU" : "WASM"}${lastMs ? ` · ${Math.round(lastMs)} ms` : ""}`;
      tone = "text-emerald-700";
      break;
    case "error":
      text = "Model error";
      tone = "text-red-700";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs tabular-nums ${tone}`}
      title={model.phase === "error" ? model.message : undefined}
    >
      <Cpu className="size-3.5" />
      {text}
    </span>
  );
}
