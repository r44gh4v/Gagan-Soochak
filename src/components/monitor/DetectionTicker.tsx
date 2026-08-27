"use client";

import { SeverityChip } from "@/components/common/SeverityChip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CLASS_LABELS, type HazardClass, type SeverityLevel } from "@/lib/detection/constants";
import type { LiveDetection } from "@/hooks/useDetectionEngine";

/** Raw model output feed — shows the model working even when nothing new becomes an incident. */
export function DetectionTicker({ items }: { items: LiveDetection[] }) {
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Raw detections appear here while the video plays.
      </p>
    );
  }
  return (
    <ScrollArea className="h-44">
      <ul className="space-y-1 pr-3">
        {items.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-xs">
            <span>{CLASS_LABELS[d.className as HazardClass] ?? d.className}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">
                {d.confidence.toFixed(2)}
              </span>
              <SeverityChip level={d.level as SeverityLevel} />
            </span>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
