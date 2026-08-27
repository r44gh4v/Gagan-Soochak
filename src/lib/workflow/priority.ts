import type { HazardClass, SeverityLevel } from "@/lib/detection/constants";
import type { Incident, Priority } from "@/lib/workflow/types";

/**
 * Severity → priority, with two class overrides grounded in monsoon reality:
 *  - waterlogged_road at Medium → P1 (standing water hides potholes and causes
 *    two-wheeler skids; it is a safety risk before it is a maintenance item)
 *  - drain_overflow at Low → P2 (sewage mix is a public-health escalation risk)
 */
export function priorityFor(cls: HazardClass, level: SeverityLevel): Priority {
  if (level === "High") return "P1";
  if (level === "Medium") return cls === "waterlogged_road" ? "P1" : "P2";
  return cls === "drain_overflow" ? "P2" : "P3";
}

/** Displayed as target-response guidance on the evidence card, not a live timer. */
export const SLA_HOURS: Record<Priority, number> = { P1: 4, P2: 24, P3: 72 };

const BUMP: Record<Priority, Priority> = { P3: "P2", P2: "P1", P1: "P1" };

export function escalate(
  incident: Incident,
  reason: string,
  now?: string,
): Incident {
  const at = now ?? new Date().toISOString();
  return {
    ...incident,
    escalated: true,
    escalatedAt: at,
    escalationReason: reason,
    priority: BUMP[incident.priority],
    slaTargetHours: SLA_HOURS[BUMP[incident.priority]],
    owner: incident.owner
      ? {
          ...incident.owner,
          department: incident.owner.department.includes("(Escalated")
            ? incident.owner.department
            : `${incident.owner.department} (Escalated — Ward Engineer)`,
        }
      : incident.owner,
    audit: [
      ...incident.audit,
      { at, actor: "Operator", action: "ESCALATED", detail: reason },
    ],
  };
}
