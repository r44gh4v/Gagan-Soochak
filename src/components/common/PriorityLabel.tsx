import type { Priority } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

/** Bold tabular text; P1 red. Redundant with severity by design — two cues scan faster. */
export function PriorityLabel({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-xs font-semibold tabular-nums",
        priority === "P1" ? "text-[#b91c1c]" : "text-zinc-700",
        className,
      )}
    >
      {priority}
    </span>
  );
}
