"use client";

import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { EmptyState } from "@/components/common/EmptyState";
import { EvidenceField } from "@/components/common/EvidenceField";
import { EvidenceImage } from "@/components/common/EvidenceImage";
import { PriorityLabel } from "@/components/common/PriorityLabel";
import { SeverityChip } from "@/components/common/SeverityChip";
import { SimulatedBadge } from "@/components/common/SimulatedBadge";
import { StatusPill } from "@/components/common/StatusPill";
import { ActionPanel } from "@/components/incident-detail/ActionPanel";
import { AuditTimeline } from "@/components/incident-detail/AuditTimeline";
import { StatusStepper } from "@/components/incident-detail/StatusStepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASS_LABELS } from "@/lib/detection/constants";
import { useIncidentStore } from "@/store/incidents";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const incident = useIncidentStore((s) => s.incidents[id]);

  if (!incident) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Incident not found"
        description={`No incident ${id} in this browser's store. Incident data is client-side - it lives where the detection ran.`}
        actionLabel="Back to queue"
        actionHref="/incidents"
      />
    );
  }

  const detectedIst = new Date(incident.detectedAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back() /* preserves queue filters + scroll */}
        >
          <ArrowLeft className="size-4" />
          Queue
        </Button>
        <h1 className="font-mono text-base font-semibold">{incident.id}</h1>
        <span className="text-sm text-muted-foreground">
          {CLASS_LABELS[incident.hazardClass]}
        </span>
        <SeverityChip level={incident.severityLevel} score={incident.severityScore} />
        <PriorityLabel priority={incident.priority} />
        <StatusPill status={incident.status} />
        {incident.escalated && (
          <span className="text-xs font-medium text-[#b45309]">Escalated</span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[5fr_4fr_3fr]">
        {/* Evidence - what happened */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EvidenceImage
              evidenceKey={incident.evidence.frameKey}
              alt="Annotated detection frame"
              className="w-full rounded-md border"
            />
            <div className="flex items-start gap-3">
              <EvidenceImage
                evidenceKey={incident.evidence.thumbnailKey}
                alt="Hazard crop"
                className="h-20 w-24 shrink-0 rounded border object-cover"
              />
              <p className="text-xs leading-snug text-muted-foreground">
                Cropped visual proof. Full frame above carries the detection
                box exactly as the model placed it, in the same severity color
                used across the dashboard.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <EvidenceField label="Event type">
                {CLASS_LABELS[incident.hazardClass]}
              </EvidenceField>
              <EvidenceField label="Model confidence" mono>
                {incident.confidence.toFixed(3)}
              </EvidenceField>
              <EvidenceField label="Severity" className="col-span-2">
                <div className="flex items-center gap-2">
                  <SeverityChip
                    level={incident.severityLevel}
                    score={incident.severityScore}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    = 0.6 × spatial {incident.severityBreakdown.spatial.toFixed(3)} + 0.4
                    × temporal {incident.severityBreakdown.temporal.toFixed(3)}
                  </span>
                </div>
              </EvidenceField>
              <EvidenceField label="Location" className="col-span-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>
                    {incident.location.landmark} · {incident.location.zone} ·{" "}
                    {incident.location.ward} ward
                  </span>
                  <SimulatedBadge tooltip="GPS interpolated along a simulated patrol route through Electronic City - deterministic per video position." />
                </div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {incident.location.lat.toFixed(6)}, {incident.location.lng.toFixed(6)}
                </div>
              </EvidenceField>
              <EvidenceField label="Detected at" className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums">{detectedIst} IST</span>
                  <SimulatedBadge
                    kind="DERIVED"
                    tooltip="Patrol start time + video timecode. Detections are real; wall-clock time is derived."
                  />
                </div>
              </EvidenceField>
              <EvidenceField label="Source" mono>
                {incident.evidence.sourceLabel} @{" "}
                {incident.evidence.videoTimeSec.toFixed(1)}s
              </EvidenceField>
              <EvidenceField label="Sightings" mono>
                {incident.sightings} consecutive
              </EvidenceField>
              <EvidenceField label="Bounding box" mono className="col-span-2">
                [{incident.evidence.bbox.map((v) => Math.round(v)).join(", ")}] in{" "}
                {incident.evidence.frameW}×{incident.evidence.frameH}
              </EvidenceField>
            </div>
          </CardContent>
        </Card>

        {/* Action - what to do */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusStepper status={incident.status} />
              {incident.resolutionNote && (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Resolution:</span>{" "}
                  {incident.resolutionNote}
                </p>
              )}
              {incident.rejectionReason && (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Rejected:</span>{" "}
                  {incident.rejectionReason}
                </p>
              )}
            </CardContent>
          </Card>
          <ActionPanel incident={incident} />
        </div>

        {/* Audit - what was done */}
        <Card className="self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline entries={incident.audit} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Deep link:{" "}
        <Link href={`/incidents/${incident.id}`} className="underline">
          /incidents/{incident.id}
        </Link>{" "}
        - note incident data is stored in the browser that ran the detection.
      </p>
    </div>
  );
}
