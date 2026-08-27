import type { AuditAction, Incident, IncidentStatus } from "@/lib/workflow/types";

/**
 * Core civic lifecycle:
 *
 *   open → assigned → in_progress → resolved → closed
 *    │        │            │            └─ verification failed → in_progress
 *    └────────┴────────────┴─ reject (false positive) → rejected
 *
 * closed / rejected are terminal. Every mutation flows through transition()
 * so an audit entry is stamped on every change — no ad-hoc status writes.
 */
export const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["assigned", "rejected"],
  assigned: ["in_progress", "rejected", "open"],
  in_progress: ["resolved", "rejected"],
  resolved: ["closed", "in_progress"],
  closed: [],
  rejected: [],
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

/** Statuses an operator still needs to act on. */
export const ACTIVE_STATUSES: IncidentStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
];

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const TRANSITION_ACTION: Record<string, AuditAction> = {
  "open>assigned": "ASSIGNED",
  "assigned>open": "REOPENED",
  "assigned>in_progress": "STARTED",
  "in_progress>resolved": "RESOLVED",
  "resolved>closed": "VERIFIED_CLOSED",
  "resolved>in_progress": "REOPENED",
  "open>rejected": "REJECTED",
  "assigned>rejected": "REJECTED",
  "in_progress>rejected": "REJECTED",
};

export function transition(
  incident: Incident,
  to: IncidentStatus,
  opts: { actor: "System" | "Operator"; note?: string; now?: string },
): Incident {
  if (!canTransition(incident.status, to)) {
    throw new Error(`illegal transition ${incident.status} → ${to}`);
  }
  const at = opts.now ?? new Date().toISOString();
  const action = TRANSITION_ACTION[`${incident.status}>${to}`];

  return {
    ...incident,
    status: to,
    closedAt: to === "closed" ? at : incident.closedAt,
    resolutionNote:
      to === "resolved" && opts.note ? opts.note : incident.resolutionNote,
    rejectionReason:
      to === "rejected" && opts.note ? opts.note : incident.rejectionReason,
    audit: [
      ...incident.audit,
      { at, actor: opts.actor, action, detail: opts.note },
    ],
  };
}
