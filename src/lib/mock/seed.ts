import { CLASS_LABELS, type HazardClass } from "@/lib/detection/constants";
import { severityLevelFor } from "@/lib/detection/severity";
import { locationAt } from "@/lib/mock/location";
import { frameKey, putEvidence, thumbKey } from "@/lib/storage/evidenceStore";
import { SLA_HOURS, priorityFor } from "@/lib/workflow/priority";
import { recommendAction } from "@/lib/workflow/playbook";
import { suggestOwner } from "@/lib/workflow/routing";
import type { AuditEntry, Incident } from "@/lib/workflow/types";

/**
 * Seeded demo incidents — clearly badged "SEED" in their source label and
 * evidence images. Demo-day insurance (a cold dashboard is a bad first
 * impression) and the deterministic dataset used to exercise the workflow
 * without running detection. Never mixed silently with real detections.
 */

type SeedSpec = {
  cls: HazardClass;
  spatial: number;
  temporal: number;
  conf: number;
  videoTime: number;
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed" | "rejected";
  escalated?: boolean;
};

const SPECS: SeedSpec[] = [
  { cls: "pothole", spatial: 0.31, temporal: 1.0, conf: 0.78, videoTime: 4, status: "open" },
  { cls: "waterlogged_road", spatial: 0.22, temporal: 0.8, conf: 0.61, videoTime: 9, status: "open" },
  { cls: "pothole", spatial: 0.05, temporal: 0.4, conf: 0.66, videoTime: 14, status: "open" },
  { cls: "drain_overflow", spatial: 0.12, temporal: 0.7, conf: 0.44, videoTime: 18, status: "assigned" },
  { cls: "pothole", spatial: 0.09, temporal: 1.0, conf: 0.71, videoTime: 23, status: "assigned", escalated: true },
  { cls: "waterlogged_road", spatial: 0.4, temporal: 1.0, conf: 0.57, videoTime: 27, status: "in_progress" },
  { cls: "pothole", spatial: 0.03, temporal: 0.3, conf: 0.52, videoTime: 31, status: "in_progress" },
  { cls: "drain_overflow", spatial: 0.2, temporal: 0.9, conf: 0.48, videoTime: 35, status: "resolved" },
  { cls: "pothole", spatial: 0.06, temporal: 1.0, conf: 0.69, videoTime: 40, status: "closed" },
  { cls: "waterlogged_road", spatial: 0.15, temporal: 0.6, conf: 0.55, videoTime: 44, status: "closed" },
  { cls: "drain_overflow", spatial: 0.04, temporal: 0.2, conf: 0.34, videoTime: 49, status: "rejected" },
  { cls: "pothole", spatial: 0.02, temporal: 0.2, conf: 0.37, videoTime: 53, status: "rejected" },
];

const SEED_STROKE: Record<string, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#059669",
};

async function seedImage(
  label: string,
  level: string,
  w: number,
  h: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3f3f46";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#52525b";
  for (let i = 0; i < 6; i++) {
    ctx.fillRect((i * w) / 6 + 6, h / 2 - 2, w / 9, 4); // lane dashes
  }
  const stroke = SEED_STROKE[level] ?? "#71717a";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.3, h * 0.45, w * 0.4, h * 0.35);
  ctx.fillStyle = stroke;
  ctx.font = `600 ${Math.max(11, h / 14)}px system-ui`;
  ctx.fillText(label, 8, 18);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `500 ${Math.max(10, h / 18)}px system-ui`;
  ctx.fillText("SEED DATA — not a real detection", 8, h - 10);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
}

export async function buildSeedIncidents(patrolStartIso: string): Promise<Incident[]> {
  const base = new Date(patrolStartIso).getTime();
  const incidents: Incident[] = [];

  for (let n = 0; n < SPECS.length; n++) {
    const s = SPECS[n];
    const id = `INC-${new Date().getFullYear()}-S${String(n + 1).padStart(3, "0")}`;
    const score = 0.6 * s.spatial + 0.4 * s.temporal;
    const level = severityLevelFor(score);
    const priority = priorityFor(s.cls, level);
    const location = locationAt("ec-hosur-road", s.videoTime, 60);
    const detectedAt = new Date(base + s.videoTime * 1000).toISOString();
    const owner =
      s.status === "open" ? null : suggestOwner(s.cls, location.zone);

    const label = `${CLASS_LABELS[s.cls]} ${s.conf.toFixed(2)} (${level})`;
    const [thumbnail, frame] = await Promise.all([
      seedImage(label, level, 240, 180),
      seedImage(label, level, 640, 360),
    ]);
    await putEvidence(thumbKey(id), thumbnail);
    await putEvidence(frameKey(id), frame);

    const audit: AuditEntry[] = [
      {
        at: detectedAt,
        actor: "System",
        action: "DETECTED",
        detail: `${s.cls} @ ${location.landmark} · conf ${s.conf.toFixed(2)} · severity ${score.toFixed(2)} (${level}) · seeded`,
      },
    ];
    const later = (min: number) => new Date(base + s.videoTime * 1000 + min * 60000).toISOString();
    if (s.status !== "open" && s.status !== "rejected") {
      audit.push({ at: later(12), actor: "Operator", action: "ASSIGNED", detail: owner ? `${owner.department} · ${owner.crew}` : undefined });
    }
    if (["in_progress", "resolved", "closed"].includes(s.status)) {
      audit.push({ at: later(45), actor: "Operator", action: "STARTED" });
    }
    if (["resolved", "closed"].includes(s.status)) {
      audit.push({ at: later(160), actor: "Operator", action: "RESOLVED", detail: "crew reported repair complete, photo attached" });
    }
    if (s.status === "closed") {
      audit.push({ at: later(220), actor: "Operator", action: "VERIFIED_CLOSED" });
    }
    if (s.status === "rejected") {
      audit.push({ at: later(8), actor: "Operator", action: "REJECTED", detail: "false positive — wet shadow patch, no physical hazard" });
    }
    if (s.escalated) {
      audit.push({ at: later(90), actor: "Operator", action: "ESCALATED", detail: "no crew response within target window" });
    }

    const escalatedPriority = s.escalated
      ? priority === "P3" ? "P2" : "P1"
      : priority;

    incidents.push({
      id,
      hazardClass: s.cls,
      severityScore: score,
      severityLevel: level,
      severityBreakdown: { spatial: s.spatial * 0.6 / 0.6, temporal: s.temporal },
      confidence: s.conf,
      priority: escalatedPriority,
      detectedAt,
      location,
      evidence: {
        thumbnailKey: thumbKey(id),
        frameKey: frameKey(id),
        bbox: [192, 162, 448, 288],
        videoTimeSec: s.videoTime,
        sourceLabel: "seed-demo (not a real clip)",
        routeId: "ec-hosur-road",
        frameW: 640,
        frameH: 360,
      },
      status: s.status,
      owner: s.escalated && owner
        ? { ...owner, department: `${owner.department} (Escalated — Ward Engineer)` }
        : owner,
      recommendedAction: recommendAction(s.cls, level),
      slaTargetHours: SLA_HOURS[escalatedPriority],
      escalated: !!s.escalated,
      escalatedAt: s.escalated ? later(90) : null,
      escalationReason: s.escalated ? "no crew response within target window" : null,
      resolutionNote: ["resolved", "closed"].includes(s.status)
        ? "crew reported repair complete, photo attached"
        : null,
      rejectionReason:
        s.status === "rejected"
          ? "false positive — wet shadow patch, no physical hazard"
          : null,
      closedAt: s.status === "closed" ? later(220) : null,
      sightings: Math.max(1, Math.round(s.temporal * 10)),
      audit,
    });
  }
  return incidents;
}
