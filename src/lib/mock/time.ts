/**
 * Derived timestamps: operator-set patrol start + video timecode, rendered
 * with the IST offset the deployment context implies. Disclosed as DERIVED
 * in the UI - detections are real, wall-clock time is synthetic.
 */
export function timestampAt(patrolStartIso: string, videoTimeSec: number): string {
  const t = new Date(patrolStartIso).getTime() + videoTimeSec * 1000;
  return new Date(t).toISOString();
}

/** Default patrol start: today 07:15 local - reads like a real morning patrol. */
export function defaultPatrolStart(): string {
  const d = new Date();
  d.setHours(7, 15, 0, 0);
  return d.toISOString();
}
