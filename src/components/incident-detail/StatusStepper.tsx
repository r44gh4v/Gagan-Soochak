import { Check, X } from "lucide-react";

import { STATUS_LABELS } from "@/lib/workflow/lifecycle";
import type { IncidentStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const STEPS: IncidentStatus[] = ["open", "assigned", "in_progress", "resolved", "closed"];

/** Visual lifecycle position. Rejected renders as its own terminal note. */
export function StatusStepper({ status }: { status: IncidentStatus }) {
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <X className="size-3.5" />
        Rejected as false positive — terminal state
      </div>
    );
  }

  const idx = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = i < idx || status === "closed";
        const current = i === idx && status !== "closed";
        return (
          <li key={step} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  "h-px flex-1",
                  i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border",
                )}
              />
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary text-primary",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </div>
              <div
                className={cn(
                  "h-px flex-1",
                  i === STEPS.length - 1
                    ? "bg-transparent"
                    : done
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "text-[10px]",
                current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
