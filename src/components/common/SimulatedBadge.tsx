import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Honesty marker for mocked/derived fields. Present but not shouting -
 * the submission declaration requires simulated data to be clearly separated.
 */
export function SimulatedBadge({
  kind = "SIMULATED",
  tooltip,
}: {
  kind?: "SIMULATED" | "DERIVED";
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center rounded border border-border bg-muted px-1 py-px text-[10px] font-medium tracking-wide text-muted-foreground">
          {kind}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
