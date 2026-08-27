"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SeverityLevel } from "@/lib/detection/constants";
import type { TrackedHazard } from "@/lib/detection/tracker";
import { locationAt } from "@/lib/mock/location";
import { timestampAt } from "@/lib/mock/time";
import {
  clearAllEvidence,
  frameKey,
  putEvidence,
  thumbKey,
} from "@/lib/storage/evidenceStore";
import { canTransition, transition } from "@/lib/workflow/lifecycle";
import { escalate, priorityFor, SLA_HOURS } from "@/lib/workflow/priority";
import { recommendAction } from "@/lib/workflow/playbook";
import { suggestOwner } from "@/lib/workflow/routing";
import type { Incident, IncidentStatus, Owner } from "@/lib/workflow/types";

export type DetectionContext = {
  routeId: string;
  patrolStartIso: string;
  videoTimeSec: number;
  videoDurationSec: number;
  sourceLabel: string;
  frameW: number;
  frameH: number;
};

type IncidentState = {
  incidents: Record<string, Incident>;
  /** Newest first. */
  order: string[];
  seq: number;

  createFromHazard: (
    hazard: TrackedHazard,
    ctx: DetectionContext,
    evidence: { thumbnail: Blob; frame: Blob },
  ) => Promise<string>;
  updateSeverity: (
    id: string,
    score: number,
    level: SeverityLevel,
    breakdown: { spatial: number; temporal: number },
    sightings: number,
  ) => void;
  markHighAlert: (id: string) => void;
  applyTransition: (id: string, to: IncidentStatus, note?: string) => void;
  assignOwner: (id: string, owner: Owner) => void;
  escalateIncident: (id: string, reason: string) => void;
  bulkTransition: (ids: string[], to: IncidentStatus, note?: string) => void;
  loadIncidents: (incidents: Incident[]) => void;
  clearAll: () => Promise<void>;
};

export const useIncidentStore = create<IncidentState>()(
  persist(
    (set, get) => ({
      incidents: {},
      order: [],
      seq: 0,

      createFromHazard: async (hazard, ctx, evidence) => {
        // Reserve the sequence number synchronously BEFORE any await — two
        // hazards on the same processed frame create concurrently, and both
        // reading seq across the IndexedDB awaits would mint the same id.
        const seq = get().seq + 1;
        set({ seq });
        const id = `INC-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;

        // Blobs land in IndexedDB first, so a stored incident never points
        // at a missing image.
        await putEvidence(thumbKey(id), evidence.thumbnail);
        await putEvidence(frameKey(id), evidence.frame);

        const location = locationAt(ctx.routeId, ctx.videoTimeSec, ctx.videoDurationSec);
        const detectedAt = timestampAt(ctx.patrolStartIso, ctx.videoTimeSec);
        const level = hazard.severity.level;
        const priority = priorityFor(hazard.className, level);

        const incident: Incident = {
          id,
          hazardClass: hazard.className,
          severityScore: hazard.severity.score,
          severityLevel: level,
          severityBreakdown: {
            spatial: hazard.severity.spatial,
            temporal: hazard.severity.temporal,
          },
          confidence: hazard.confidence,
          priority,
          detectedAt,
          location,
          evidence: {
            thumbnailKey: thumbKey(id),
            frameKey: frameKey(id),
            bbox: hazard.bbox,
            videoTimeSec: ctx.videoTimeSec,
            sourceLabel: ctx.sourceLabel,
            routeId: ctx.routeId,
            frameW: ctx.frameW,
            frameH: ctx.frameH,
          },
          status: "open",
          owner: null,
          recommendedAction: recommendAction(hazard.className, level),
          slaTargetHours: SLA_HOURS[priority],
          escalated: false,
          escalatedAt: null,
          escalationReason: null,
          resolutionNote: null,
          rejectionReason: null,
          closedAt: null,
          sightings: hazard.consecutiveCount,
          audit: [
            {
              at: new Date().toISOString(),
              actor: "System",
              action: "DETECTED",
              detail: `${hazard.className} @ ${location.landmark} · conf ${hazard.confidence.toFixed(2)} · severity ${hazard.severity.score.toFixed(2)} (${level})`,
            },
          ],
        };

        set((s) => ({
          // seq already committed above — re-writing it here would roll it
          // back under a concurrent creation and re-open the id collision
          incidents: { ...s.incidents, [id]: incident },
          order: [id, ...s.order],
        }));
        return id;
      },

      updateSeverity: (id, score, level, breakdown, sightings) =>
        set((s) => {
          const inc = s.incidents[id];
          if (!inc) return s;
          const priority = priorityFor(inc.hazardClass, level);
          return {
            incidents: {
              ...s.incidents,
              [id]: {
                ...inc,
                severityScore: score,
                severityLevel: level,
                severityBreakdown: breakdown,
                sightings,
                // severity change re-derives priority/playbook only while
                // still open - an operator's triage decisions are not
                // silently overwritten afterwards
                ...(inc.status === "open"
                  ? {
                      priority,
                      slaTargetHours: SLA_HOURS[priority],
                      recommendedAction: recommendAction(inc.hazardClass, level),
                    }
                  : {}),
                audit: [
                  ...inc.audit,
                  {
                    at: new Date().toISOString(),
                    actor: "System" as const,
                    action: "SEVERITY_CHANGED" as const,
                    detail: `severity now ${score.toFixed(2)} (${level})`,
                  },
                ],
              },
            },
          };
        }),

      markHighAlert: (id) =>
        set((s) => {
          const inc = s.incidents[id];
          if (!inc) return s;
          return {
            incidents: {
              ...s.incidents,
              [id]: {
                ...inc,
                audit: [
                  ...inc.audit,
                  {
                    at: new Date().toISOString(),
                    actor: "System" as const,
                    action: "HIGH_ALERT" as const,
                    detail: "first crossing into High severity",
                  },
                ],
              },
            },
          };
        }),

      applyTransition: (id, to, note) =>
        set((s) => {
          const inc = s.incidents[id];
          if (!inc) return s;
          return {
            incidents: {
              ...s.incidents,
              [id]: transition(inc, to, { actor: "Operator", note }),
            },
          };
        }),

      assignOwner: (id, owner) =>
        set((s) => {
          const inc = s.incidents[id];
          if (!inc) return s;
          const next =
            inc.status === "open"
              ? transition(inc, "assigned", {
                  actor: "Operator",
                  note: `${owner.department} · ${owner.crew}`,
                })
              : inc;
          return { incidents: { ...s.incidents, [id]: { ...next, owner } } };
        }),

      escalateIncident: (id, reason) =>
        set((s) => {
          const inc = s.incidents[id];
          if (!inc) return s;
          return { incidents: { ...s.incidents, [id]: escalate(inc, reason) } };
        }),

      bulkTransition: (ids, to, note) => {
        for (const id of ids) {
          const inc = get().incidents[id];
          if (inc && canTransition(inc.status, to)) {
            get().applyTransition(id, to, note);
          }
        }
      },

      loadIncidents: (incidents) =>
        set((s) => {
          const merged = { ...s.incidents };
          const order = [...s.order];
          let seq = s.seq;
          for (const inc of incidents) {
            if (!merged[inc.id]) order.unshift(inc.id);
            merged[inc.id] = inc;
            const n = Number(inc.id.split("-").pop());
            if (Number.isFinite(n) && n > seq) seq = n;
          }
          return { incidents: merged, order, seq };
        }),

      clearAll: async () => {
        await clearAllEvidence();
        set({ incidents: {}, order: [], seq: 0 });
      },
    }),
    {
      name: "gagan-soochak-incidents",
      // metadata only - evidence blobs live in IndexedDB
    },
  ),
);

/** Suggested owner for the assign dropdown, derived from class + zone. */
export function suggestedOwnerFor(incident: Incident): Owner {
  return suggestOwner(incident.hazardClass, incident.location.zone);
}
