"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONF_THRESHOLD } from "@/lib/detection/constants";
import { downloadFile, toCSV, toJSON } from "@/lib/export/serialize";
import type { Incident } from "@/lib/workflow/types";
import { useSessionStore } from "@/store/session";

export function ExportMenu({ incidents }: { incidents: Incident[] }) {
  const buildHeader = () => {
    const s = useSessionStore.getState();
    return {
      exportedAt: new Date().toISOString(),
      model: "yolov8n best.onnx (3-class, fp32, on-device)",
      backend: s.model.phase === "ready" ? s.model.backend : "n/a",
      confThreshold: s.confThreshold ?? CONF_THRESHOLD,
      processEveryN: s.skipN,
      framesProcessed: s.perf.framesProcessed,
      avgInferenceMs:
        s.perf.framesProcessed > 0
          ? +(s.perf.inferenceMsTotal / s.perf.framesProcessed).toFixed(1)
          : 0,
      sessionSource: s.sourceLabel || "n/a",
    };
  };

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="size-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            downloadFile(
              `incidents_export_${stamp()}.json`,
              toJSON(incidents, buildHeader()),
              "application/json",
            );
            toast(`Exported ${incidents.length} incidents as JSON`);
          }}
        >
          JSON (full incidents + run header)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            downloadFile(
              `incidents_export_${stamp()}.csv`,
              toCSV(incidents),
              "text/csv",
            );
            toast(`Exported ${incidents.length} incidents as CSV`);
          }}
        >
          CSV (flat, Excel-friendly)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
