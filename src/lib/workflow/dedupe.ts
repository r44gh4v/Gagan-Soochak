import type { HazardClass } from "@/lib/detection/constants";
import { distanceMeters } from "@/lib/mock/location";
import { ACTIVE_STATUSES } from "@/lib/workflow/lifecycle";
import type { Incident, IncidentLocation } from "@/lib/workflow/types";

/**
 * Repeat-sighting clustering.
 *
 * The tracker drops a hazard once it leaves frame (HAZARD_EXPIRE_GAP), so a
 * single pothole a vehicle approaches, passes and glances back at produces
 * several independent tracks. Logging each as its own work item is what the
 * Python pipeline does — correct as a *detection* record, wrong as a *civic*
 * one: it hands a ward engineer twenty tickets for one pothole and destroys
 * the operator's ability to act quickly.
 *
 * So the dashboard clusters at the incident layer: same hazard class, within
 * DEDUPE_RADIUS_M, within DEDUPE_WINDOW_MIN, still open for action → the same
 * physical defect. Detection, tracking and severity maths are untouched; this
 * is bookkeeping on top, and every merge is recorded in the audit trail.
 */

/** Roughly one road segment either side — tight enough to keep distinct defects apart. */
export const DEDUPE_RADIUS_M = 25;

/** Sightings further apart in time are treated as a fresh report. */
export const DEDUPE_WINDOW_MIN = 30;

export function findDuplicate(
  incidents: Incident[],
  hazardClass: HazardClass,
  location: IncidentLocation,
  detectedAt: string,
): Incident | null {
  const at = new Date(detectedAt).getTime();
  let best: Incident | null = null;
  let bestDist = DEDUPE_RADIUS_M;

  for (const inc of incidents) {
    if (inc.hazardClass !== hazardClass) continue;
    // Closed means it was repaired and verified; rejected means an operator
    // ruled it out. A new sighting of either is genuinely new information.
    if (!ACTIVE_STATUSES.includes(inc.status)) continue;

    const minutes = Math.abs(at - new Date(inc.detectedAt).getTime()) / 60000;
    if (minutes > DEDUPE_WINDOW_MIN) continue;

    const d = distanceMeters(inc.location, location);
    if (d < bestDist) {
      best = inc;
      bestDist = d;
    }
  }
  return best;
}
