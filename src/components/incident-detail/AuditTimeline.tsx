import type { AuditEntry } from "@/lib/workflow/types";

const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  DETECTED: "Detected",
  SEVERITY_CHANGED: "Severity changed",
  HIGH_ALERT: "High-severity alert",
  ASSIGNED: "Assigned",
  REOPENED: "Reopened",
  STARTED: "Work started",
  RESOLVED: "Resolved",
  VERIFIED_CLOSED: "Verified & closed",
  REJECTED: "Rejected",
  ESCALATED: "Escalated",
};

/** Who did what, when - the literal answer to "how is status tracked?" */
export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  const newest = [...entries].reverse();
  return (
    <ol className="space-y-3">
      {newest.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative border-l-2 border-border pl-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium">{ACTION_LABELS[e.action]}</span>
            <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {new Date(e.at).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <div className="text-[11px] text-muted-foreground">{e.actor}</div>
          {e.detail && (
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {e.detail}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
