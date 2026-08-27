import { STATUS_LABELS } from "@/lib/workflow/lifecycle";
import type { IncidentStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const DOT: Record<IncidentStatus, string> = {
  open: "bg-zinc-500",
  assigned: "bg-blue-600",
  in_progress: "bg-violet-600",
  resolved: "bg-teal-600",
  closed: "bg-zinc-700",
  rejected: "bg-zinc-400",
};

/** Deliberately quieter than severity: a small dot + neutral text, no fill. */
export function StatusPill({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-foreground",
        status === "rejected" && "text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[status])} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
