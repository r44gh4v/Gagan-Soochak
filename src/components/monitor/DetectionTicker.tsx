"use client";

import { SeverityChip } from "@/components/common/SeverityChip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CLASS_LABELS,
  type HazardClass,
  type SeverityLevel,
} from "@/lib/detection/constants";
import type { LiveDetection } from "@/hooks/useDetectionEngine";

/** Raw model output feed - shows the model working even when nothing new becomes an incident. */
export function DetectionTicker({ items }: { items: LiveDetection[] }) {
  if (!items.length) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Detections appear here as the clip plays. New hazards are logged to the
        Queue automatically, at whatever severity they start at.
      </p>
    );
  }
  return (
    <ScrollArea className="h-full">
      <ul className="space-y-1 pr-3">
        {items.map((d) => (
          <li
            key={d.key}
            className="flex items-center justify-between gap-2 border-b py-1 text-xs last:border-0"
          >
            <span className="truncate">
              {CLASS_LABELS[d.className as HazardClass] ?? d.className}
            </span>
            <span className="flex shrink-0 items-center gap-2">
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
