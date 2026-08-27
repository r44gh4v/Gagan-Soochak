"use client";

import { ArrowUpRight, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/common/ReasonDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ROUTING } from "@/lib/workflow/routing";
import type { Incident } from "@/lib/workflow/types";
import { suggestedOwnerFor, useIncidentStore } from "@/store/incidents";

/**
 * Only legal transitions render as buttons — illegal ones are absent, not
 * greyed. Reversible actions apply immediately with a toast; irreversible
 * ones (reject, close) and escalation require a recorded reason/note.
 */
export function ActionPanel({ incident }: { incident: Incident }) {
  const assignOwner = useIncidentStore((s) => s.assignOwner);
  const applyTransition = useIncidentStore((s) => s.applyTransition);
  const escalateIncident = useIncidentStore((s) => s.escalateIncident);
  const [dialog, setDialog] = useState<"reject" | "resolve" | "escalate" | null>(null);

  const act = (fn: () => void, msg: string) => {
    fn();
    toast(msg);
  };

  const suggested = suggestedOwnerFor(incident);
  const terminal = incident.status === "closed" || incident.status === "rejected";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Response</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Recommended action
          </div>
          <p className="mt-1 text-sm leading-snug">{incident.recommendedAction}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            Target response: {incident.slaTargetHours} h ({incident.priority})
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Owner
          </div>
          {incident.owner ? (
            <div className="mt-1 text-sm">
              <div className="font-medium">{incident.owner.department}</div>
              <div className="text-xs text-muted-foreground">
                {incident.owner.crew} · {incident.owner.contact}
              </div>
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              <div className="text-xs text-muted-foreground">
                Suggested: {suggested.department} · {suggested.crew} (
                {ROUTING[incident.hazardClass].crewPrefix})
              </div>
              {incident.status === "open" && (
                <Button
                  size="sm"
                  onClick={() =>
                    act(
                      () => assignOwner(incident.id, suggested),
                      `Assigned to ${suggested.department}`,
                    )
                  }
                >
                  Assign to suggested owner
                </Button>
              )}
            </div>
          )}
        </div>

        {!terminal && <Separator />}

        <div className="flex flex-wrap gap-2">
          {incident.status === "assigned" && (
            <Button
              size="sm"
              onClick={() =>
                act(() => applyTransition(incident.id, "in_progress"), "Work started")
              }
            >
              Start work
            </Button>
          )}
          {incident.status === "in_progress" && (
            <Button size="sm" onClick={() => setDialog("resolve")}>
              Mark resolved
            </Button>
          )}
          {incident.status === "resolved" && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  act(
                    () => applyTransition(incident.id, "closed"),
                    `${incident.id} verified & closed`,
                  )
                }
              >
                Verify &amp; close
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  act(
                    () =>
                      applyTransition(
                        incident.id,
                        "in_progress",
                        "verification failed — reopened",
                      ),
                    "Reopened for rework",
                  )
                }
              >
                Verification failed — reopen
              </Button>
            </>
          )}
          {["open", "assigned", "in_progress"].includes(incident.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDialog("reject")}
            >
              Reject (false positive)
            </Button>
          )}
          {!terminal && !incident.escalated && (
            <Button size="sm" variant="outline" onClick={() => setDialog("escalate")}>
              <ArrowUpRight className="size-3.5" />
              Escalate
            </Button>
          )}
        </div>

        {incident.escalated && (
          <p className="text-xs text-[#b45309]">
            Escalated{" "}
            {incident.escalatedAt &&
              `at ${new Date(incident.escalatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST`}
            {incident.escalationReason && ` — ${incident.escalationReason}`}
          </p>
        )}
      </CardContent>

      <ReasonDialog
        open={dialog === "reject"}
        title={`Reject ${incident.id}`}
        description="Marks this detection as a false positive. It leaves the active queue but stays on record under the Rejected filter."
        confirmLabel="Reject as false positive"
        destructive
        onOpenChange={(o) => !o && setDialog(null)}
        onConfirm={(reason) =>
          act(
            () => applyTransition(incident.id, "rejected", reason),
            `${incident.id} rejected`,
          )
        }
      />
      <ReasonDialog
        open={dialog === "resolve"}
        title={`Resolve ${incident.id}`}
        description="Records what was done. The incident then awaits verification before closure."
        confirmLabel="Mark resolved"
        onOpenChange={(o) => !o && setDialog(null)}
        onConfirm={(note) =>
          act(
            () => applyTransition(incident.id, "resolved", note),
            `${incident.id} resolved — awaiting verification`,
          )
        }
      />
      <ReasonDialog
        open={dialog === "escalate"}
        title={`Escalate ${incident.id}`}
        description={`Bumps priority one band (currently ${incident.priority}) and flags the ward engineer.`}
        confirmLabel="Escalate"
        onOpenChange={(o) => !o && setDialog(null)}
        onConfirm={(reason) =>
          act(() => escalateIncident(incident.id, reason), `${incident.id} escalated`)
        }
      />
    </Card>
  );
}
