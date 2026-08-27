import type { Incident } from "@/lib/workflow/types";

/**
 * Evidence export. CSV is flat and Excel-friendly; JSON carries the full
 * incident objects plus a run header describing exactly how the session was
 * configured. `location_source` is literally "simulated" in every row —
 * honesty survives the export.
 */

export type RunHeader = {
  exportedAt: string;
  model: string;
  backend: string;
  confThreshold: number;
  processEveryN: number;
  framesProcessed: number;
  avgInferenceMs: number;
  sessionSource: string;
};

export function toJSON(incidents: Incident[], header: RunHeader): string {
  return JSON.stringify({ run: header, incidents }, null, 2);
}

const CSV_COLUMNS = [
  "incident_id",
  "detected_at",
  "hazard_class",
  "severity_score",
  "severity_level",
  "spatial_term",
  "temporal_term",
  "confidence",
  "priority",
  "zone",
  "ward",
  "landmark",
  "latitude",
  "longitude",
  "location_source",
  "source_clip",
  "video_time_sec",
  "bbox_x1",
  "bbox_y1",
  "bbox_x2",
  "bbox_y2",
  "status",
  "department",
  "crew",
  "recommended_action",
  "sla_target_hours",
  "escalated",
  "escalated_at",
  "resolution_note",
  "rejection_reason",
  "closed_at",
  "sightings",
  "audit_entry_count",
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(incidents: Incident[]): string {
  const rows = incidents.map((i) =>
    [
      i.id,
      i.detectedAt,
      i.hazardClass,
      i.severityScore.toFixed(4),
      i.severityLevel,
      i.severityBreakdown.spatial.toFixed(4),
      i.severityBreakdown.temporal.toFixed(4),
      i.confidence.toFixed(4),
      i.priority,
      i.location.zone,
      i.location.ward,
      i.location.landmark,
      i.location.lat,
      i.location.lng,
      "simulated",
      i.evidence.sourceLabel,
      i.evidence.videoTimeSec.toFixed(2),
      Math.round(i.evidence.bbox[0]),
      Math.round(i.evidence.bbox[1]),
      Math.round(i.evidence.bbox[2]),
      Math.round(i.evidence.bbox[3]),
      i.status,
      i.owner?.department,
      i.owner?.crew,
      i.recommendedAction,
      i.slaTargetHours,
      i.escalated,
      i.escalatedAt,
      i.resolutionNote,
      i.rejectionReason,
      i.closedAt,
      i.sightings,
      i.audit.length,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

export function downloadFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
