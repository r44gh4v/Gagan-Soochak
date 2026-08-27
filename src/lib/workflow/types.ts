import type { HazardClass, SeverityLevel } from "@/lib/detection/constants";
import type { BBox } from "@/lib/model/types";

export type Priority = "P1" | "P2" | "P3";

export type IncidentStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected";

export type AuditAction =
  | "DETECTED"
  | "SEVERITY_CHANGED"
  | "HIGH_ALERT"
  | "ASSIGNED"
  | "REOPENED"
  | "STARTED"
  | "RESOLVED"
  | "VERIFIED_CLOSED"
  | "REJECTED"
  | "ESCALATED";

export type AuditEntry = {
  at: string; // ISO
  actor: "System" | "Operator";
  action: AuditAction;
  detail?: string;
};

export type Owner = {
  department: string;
  crew: string;
  contact: string;
};

export type IncidentLocation = {
  lat: number;
  lng: number;
  landmark: string;
  zone: string;
  ward: string;
  /** Always true in this build - GPS is interpolated along a mock patrol route. */
  simulated: true;
};

export type IncidentEvidence = {
  /** IndexedDB keys for the stored JPEG blobs. */
  thumbnailKey: string;
  frameKey: string;
  bbox: BBox;
  videoTimeSec: number;
  sourceLabel: string;
  routeId: string;
  frameW: number;
  frameH: number;
};

export type Incident = {
  id: string; // INC-2026-0431
  hazardClass: HazardClass;
  severityScore: number;
  severityLevel: SeverityLevel;
  severityBreakdown: { spatial: number; temporal: number };
  confidence: number;
  priority: Priority;

  detectedAt: string; // ISO, patrol start + video timecode (derived, disclosed)
  location: IncidentLocation;
  evidence: IncidentEvidence;

  status: IncidentStatus;
  owner: Owner | null;
  recommendedAction: string;
  slaTargetHours: number; // displayed guidance, not an enforced timer

  escalated: boolean;
  escalatedAt: string | null;
  escalationReason: string | null;

  resolutionNote: string | null;
  rejectionReason: string | null;
  closedAt: string | null;

  /** Times the tracker re-confirmed this hazard (consecutive detections). */
  sightings: number;
  audit: AuditEntry[];
};
