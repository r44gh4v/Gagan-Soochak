"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EvidenceImage } from "@/components/common/EvidenceImage";
import { PriorityLabel } from "@/components/common/PriorityLabel";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { SeverityChip } from "@/components/common/SeverityChip";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CLASS_LABELS } from "@/lib/detection/constants";
import type { Incident } from "@/lib/workflow/types";
import { suggestedOwnerFor, useIncidentStore } from "@/store/incidents";

export function IncidentTable({
  incidents,
  selected,
  onSelectedChange,
}: {
  incidents: Incident[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
}) {
  const router = useRouter();
  const assignOwner = useIncidentStore((s) => s.assignOwner);
  const applyTransition = useIncidentStore((s) => s.applyTransition);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const allSelected =
    incidents.length > 0 && incidents.every((i) => selected.has(i.id));

  const toggleAll = () =>
    onSelectedChange(allSelected ? new Set() : new Set(incidents.map((i) => i.id)));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const quickAssign = (inc: Incident) => {
    const owner = suggestedOwnerFor(inc);
    assignOwner(inc.id, owner);
    toast(`${inc.id} assigned`, { description: `${owner.department} · ${owner.crew}` });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </TableHead>
            <TableHead className="w-14">Proof</TableHead>
            <TableHead>Incident</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead className="w-10">Pri</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Detected</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-36 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((inc) => (
            <TableRow
              key={inc.id}
              onClick={() => router.push(`/incidents/${inc.id}`)}
              className="group h-[52px] cursor-pointer"
              data-state={selected.has(inc.id) ? "selected" : undefined}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(inc.id)}
                  onCheckedChange={() => toggle(inc.id)}
                />
              </TableCell>
              <TableCell>
                <EvidenceImage
                  evidenceKey={inc.evidence.thumbnailKey}
                  alt={`${inc.hazardClass} evidence`}
                  className="h-10 w-12 rounded border object-cover"
                />
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{inc.id}</div>
                <div className="text-xs text-muted-foreground">
                  {CLASS_LABELS[inc.hazardClass]}
                  {inc.escalated && (
                    <span className="ml-1 text-[#b45309]">· escalated</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <SeverityChip level={inc.severityLevel} score={inc.severityScore} />
              </TableCell>
              <TableCell>
                <PriorityLabel priority={inc.priority} />
              </TableCell>
              <TableCell>
                <div className="text-xs">{inc.location.zone}</div>
                <div className="max-w-44 truncate text-xs text-muted-foreground">
                  {inc.location.landmark}
                </div>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(inc.detectedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs tabular-nums">
                    {new Date(inc.detectedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <StatusPill status={inc.status} />
              </TableCell>
              <TableCell>
                <div className="max-w-36 truncate text-xs text-muted-foreground">
                  {inc.owner ? inc.owner.department : "—"}
                </div>
              </TableCell>
              <TableCell
                className="text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="invisible flex justify-end gap-1 group-hover:visible">
                  {inc.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => quickAssign(inc)}
                    >
                      Assign
                    </Button>
                  )}
                  {["open", "assigned", "in_progress"].includes(inc.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setRejectId(inc.id)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ReasonDialog
        open={rejectId !== null}
        title={`Reject ${rejectId ?? ""}`}
        description="Marks this detection as a false positive. It leaves the active queue but stays on record under the Rejected filter."
        confirmLabel="Reject as false positive"
        destructive
        onOpenChange={(o) => !o && setRejectId(null)}
        onConfirm={(reason) => {
          if (rejectId) {
            applyTransition(rejectId, "rejected", reason);
            toast(`${rejectId} rejected`, { description: reason });
          }
        }}
      />
    </>
  );
}
