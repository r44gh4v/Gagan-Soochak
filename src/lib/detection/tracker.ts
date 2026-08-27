import {
  HAZARD_EXPIRE_GAP,
  MATCH_DISTANCE_THRESHOLD,
  type HazardClass,
  type SeverityLevel,
} from "@/lib/detection/constants";
import { computeSeverity, type SeverityResult } from "@/lib/detection/severity";
import type { BBox, Detection } from "@/lib/model/types";

export type TrackedHazard = {
  /** Stable key for overlay/React identity. */
  key: string;
  className: HazardClass;
  bbox: BBox;
  confidence: number;
  consecutiveCount: number;
  lastSeenIdx: number;
  /** One-time High alert already fired (pipeline.py "alerted"). */
  alerted: boolean;
  /** Incident id once logged (pipeline.py "db_id"). */
  incidentId: string | null;
  /** Severity level at last incident write (pipeline.py "last_logged_level"). */
  lastLoggedLevel: SeverityLevel | null;
  severity: SeverityResult;
  firstSeenVideoTime: number;
};

export type TrackerUpdate = {
  /** Hazards first seen this frame → INSERT an incident. */
  created: TrackedHazard[];
  /** Severity LEVEL changed since last write → UPDATE the incident. */
  levelChanged: TrackedHazard[];
  /** Crossed into High for the first time this frame → one-time alert. */
  highAlerts: TrackedHazard[];
  /** All currently-active hazards, for the every-frame overlay. */
  active: TrackedHazard[];
};

function centroid(box: BBox): [number, number] {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

/** pipeline.py normalized_distance (L158-164): 0 = same point, 1 = frame diagonal. */
function normalizedDistance(a: BBox, b: BBox, frameW: number, frameH: number): number {
  const [ax, ay] = centroid(a);
  const [bx, by] = centroid(b);
  const diagonal = Math.hypot(frameW, frameH);
  return Math.hypot(ax - bx, ay - by) / diagonal;
}

/**
 * Line-for-line port of pipeline.py HazardTracker (L194-242): nearest-centroid
 * matching within the same class, each active hazard claimable once per frame,
 * expiry by processed-frame index (not a miss counter).
 */
export class HazardTracker {
  active: TrackedHazard[] = [];
  private seq = 0;

  update(
    detections: Detection[],
    processedIdx: number,
    frameW: number,
    frameH: number,
    videoTime: number,
  ): TrackerUpdate {
    const matched = new Set<number>();
    const created: TrackedHazard[] = [];
    const levelChanged: TrackedHazard[] = [];
    const highAlerts: TrackedHazard[] = [];

    for (const det of detections) {
      // best_dist starts AT the threshold (L212): "nothing under 0.15" → new hazard
      let bestMatch = -1;
      let bestDist = MATCH_DISTANCE_THRESHOLD;
      for (let i = 0; i < this.active.length; i++) {
        const hazard = this.active[i];
        if (matched.has(i) || hazard.className !== det.className) continue;
        const dist = normalizedDistance(hazard.bbox, det.bbox, frameW, frameH);
        if (dist < bestDist) {
          bestMatch = i;
          bestDist = dist;
        }
      }

      let hazard: TrackedHazard;
      if (bestMatch >= 0) {
        hazard = this.active[bestMatch];
        hazard.bbox = det.bbox;
        hazard.confidence = det.confidence;
        hazard.consecutiveCount += 1;
        hazard.lastSeenIdx = processedIdx;
        matched.add(bestMatch);
      } else {
        hazard = {
          key: `hz-${++this.seq}`,
          className: det.className,
          bbox: det.bbox,
          confidence: det.confidence,
          consecutiveCount: 1,
          lastSeenIdx: processedIdx,
          alerted: false,
          incidentId: null,
          lastLoggedLevel: null,
          severity: { score: 0, level: "Low", spatial: 0, temporal: 0 },
          firstSeenVideoTime: videoTime,
        };
        // NOT added to `matched` - pipeline.py only marks matched indices, so
        // a hazard created earlier in this same update() call stays claimable
        // by later detections in the same frame (they merge, not duplicate).
        this.active.push(hazard);
      }

      hazard.severity = computeSeverity(det.bbox, frameW, frameH, hazard.consecutiveCount);
      const level = hazard.severity.level;

      if (hazard.incidentId === null && hazard.lastLoggedLevel === null) {
        // logged the moment it's first seen, at whatever severity it starts at
        hazard.lastLoggedLevel = level;
        created.push(hazard);
      } else if (level !== hazard.lastLoggedLevel) {
        hazard.lastLoggedLevel = level;
        levelChanged.push(hazard);
      }

      // one-time alert the first time it crosses High (pipeline.py L325-332)
      if (level === "High" && !hazard.alerted) {
        hazard.alerted = true;
        highAlerts.push(hazard);
      }
    }

    // expiry by frame index gap, exactly L237-240
    this.active = this.active.filter(
      (h) => processedIdx - h.lastSeenIdx <= HAZARD_EXPIRE_GAP,
    );

    return { created, levelChanged, highAlerts, active: this.active };
  }

  reset(): void {
    this.active = [];
    this.seq = 0;
  }
}
