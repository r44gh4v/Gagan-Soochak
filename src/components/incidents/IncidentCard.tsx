"use client";

import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { EvidenceImage } from "@/components/common/EvidenceImage";
import { PriorityLabel } from "@/components/common/PriorityLabel";
import { SeverityChip } from "@/components/common/SeverityChip";
import { SimulatedBadge } from "@/components/common/SimulatedBadge";
import { StatusPill } from "@/components/common/StatusPill";
import { Card, CardContent } from "@/components/ui/card";
import { CLASS_LABELS } from "@/lib/detection/constants";
import type { Incident } from "@/lib/workflow/types";

/** The evidence card the brief names: visual proof + every key field at a glance. */
export function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link href={`/incidents/${incident.id}`} className="block">
      <Card className="gap-0 overflow-hidden py-0 transition-colors hover:border-primary/50">
        <EvidenceImage
          evidenceKey={incident.evidence.frameKey}
          alt={`${incident.hazardClass} evidence frame`}
          className="h-36 w-full border-b object-cover"
        />
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs">{incident.id}</span>
            <span className="flex items-center gap-2">
              <PriorityLabel priority={incident.priority} />
              <SeverityChip level={incident.severityLevel} score={incident.severityScore} />
            </span>
          </div>
          <div className="text-sm font-medium">
            {CLASS_LABELS[incident.hazardClass]}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">
              {incident.location.landmark} · {incident.location.zone}
            </span>
            <SimulatedBadge tooltip="GPS interpolated along a simulated patrol route through Electronic City." />
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {incident.recommendedAction}
          </p>
          <div className="flex items-center justify-between border-t pt-2">
            <StatusPill status={incident.status} />
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNowStrict(new Date(incident.detectedAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
