import { routeById } from "@/lib/mock/routes";
import type { IncidentLocation } from "@/lib/workflow/types";

/**
 * Deterministic simulated GPS: linearly interpolate lat/lng along the route's
 * waypoint chain by video progress; landmark/zone/ward come from the nearer
 * waypoint. Same video position → identical coordinates on every run.
 */
export function locationAt(
  routeId: string,
  videoTimeSec: number,
  durationSec: number,
): IncidentLocation {
  const route = routeById(routeId);
  const wps = route.waypoints;
  const progress =
    durationSec > 0 ? Math.min(Math.max(videoTimeSec / durationSec, 0), 1) : 0;

  const segments = wps.length - 1;
  const pos = progress * segments;
  const idx = Math.min(Math.floor(pos), segments - 1);
  const t = pos - idx;

  const a = wps[idx];
  const b = wps[idx + 1];
  const near = t < 0.5 ? a : b;

  return {
    lat: +(a.lat + (b.lat - a.lat) * t).toFixed(6),
    lng: +(a.lng + (b.lng - a.lng) * t).toFixed(6),
    landmark: near.landmark,
    zone: near.zone,
    ward: near.ward,
    simulated: true,
  };
}
