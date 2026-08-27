import type { SeverityLevel } from "@/lib/detection/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<SeverityLevel, string> = {
  High: "text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]",
  Medium: "text-[#b45309] bg-[#fffbeb] border-[#fde68a]",
  Low: "text-[#047857] bg-[#ecfdf5] border-[#a7f3d0]",
};

/**
 * The one saturated fill in the UI. Always carries its text label — severity
 * is never communicated by color alone.
 */
export function SeverityChip({
  level,
  score,
  className,
}: {
  level: SeverityLevel;
  score?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular",
        STYLES[level],
        className,
      )}
    >
      {score !== undefined && <span className="tabular-nums">{score.toFixed(2)}</span>}
      {level}
    </span>
  );
}
