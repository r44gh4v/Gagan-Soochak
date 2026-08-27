import {
  DETECTION_WINDOW,
  SEVERITY_LEVELS,
  SEVERITY_SPATIAL_WEIGHT,
  SEVERITY_TEMPORAL_WEIGHT,
  type SeverityLevel,
} from "@/lib/detection/constants";
import type { BBox } from "@/lib/model/types";

export type SeverityResult = {
  score: number;
  level: SeverityLevel;
  /** bbox_area / frame_area — how much of the frame the hazard occupies. */
  spatial: number;
  /** min(consecutive, window) / window — how long it has persisted. */
  temporal: number;
};

/** Port of pipeline.py compute_severity (L174-182) + severity_level_for (L167-171). */
export function computeSeverity(
  bbox: BBox,
  frameW: number,
  frameH: number,
  consecutiveCount: number,
): SeverityResult {
  const spatial = ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / (frameW * frameH);
  const temporal = Math.min(consecutiveCount, DETECTION_WINDOW) / DETECTION_WINDOW;
  const score = SEVERITY_SPATIAL_WEIGHT * spatial + SEVERITY_TEMPORAL_WEIGHT * temporal;
  return { score, level: severityLevelFor(score), spatial, temporal };
}

export function severityLevelFor(score: number): SeverityLevel {
  for (const [threshold, label] of SEVERITY_LEVELS) {
    if (score >= threshold) return label;
  }
  return "Low";
}
