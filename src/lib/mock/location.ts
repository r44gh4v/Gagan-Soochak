import { routeById, type Waypoint } from "@/lib/mock/routes";
import type { IncidentLocation } from "@/lib/workflow/types";

/**
 * Deterministic simulated GPS.
 *
 * The patrol vehicle advances along the route at a realistic speed, so a short
 * clip covers a short stretch of road. (Normalising video time across the full
 * route length instead put consecutive detections ~773 m apart on an 8.9 s
 * clip - one pothole would appear in four different wards.)
 *
 * Same video position always yields identical coordinates, so a re-run
 * reproduces identical evidence.
 */

/** ~30 km/h: a survey vehicle on an arterial road. */
export const PATROL_SPEED_MPS = 8.33;

const EARTH_R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Equirectangular approximation - accurate well under a metre at city scale. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const midLat = rad((a.lat + b.lat) / 2);
  return Math.hypot(dLat, dLng * Math.cos(midLat)) * EARTH_R;
}

function segmentLengths(wps: Waypoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    out.push(distanceMeters(wps[i], wps[i + 1]));
  }
  return out;
}

export function locationAt(routeId: string, videoTimeSec: number): IncidentLocation {
  const route = routeById(routeId);
  const wps = route.waypoints;
  const segs = segmentLengths(wps);
  const total = segs.reduce((a, b) => a + b, 0);

  // Distance covered so far, clamped to the route (a patrol doesn't loop).
  let remaining = Math.min(Math.max(videoTimeSec, 0) * PATROL_SPEED_MPS, total);

  let idx = 0;
  while (idx < segs.length - 1 && remaining > segs[idx]) {
    remaining -= segs[idx];
    idx++;
  }
  const t = segs[idx] > 0 ? Math.min(remaining / segs[idx], 1) : 0;

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
