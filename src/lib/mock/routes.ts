/**
 * Simulated patrol routes through Electronic City, Bengaluru. Coordinates are
 * approximate real-world points; every location derived from them is badged
 * SIMULATED in the UI and disclosed on /about. Interpolation is deterministic:
 * the same video position always yields identical coordinates, so a re-run
 * reproduces identical evidence.
 */

export type Waypoint = {
  lat: number;
  lng: number;
  landmark: string;
  zone: string;
  ward: string;
};

export type PatrolRoute = {
  id: string;
  label: string;
  waypoints: Waypoint[];
};

export const ROUTES: PatrolRoute[] = [
  {
    id: "ec-hosur-road",
    label: "Hosur Road Corridor - EC Flyover → Bommasandra",
    waypoints: [
      { lat: 12.8452, lng: 77.6602, landmark: "Electronic City Flyover (Toll Plaza)", zone: "EC Phase 1", ward: "Bommanahalli" },
      { lat: 12.8465, lng: 77.6625, landmark: "Infosys Gate 1, Hosur Road", zone: "EC Phase 1", ward: "Bommanahalli" },
      { lat: 12.8421, lng: 77.6648, landmark: "Neeladri Road Junction", zone: "EC Phase 1", ward: "Bommanahalli" },
      { lat: 12.838, lng: 77.6601, landmark: "Wipro Gate, Doddathoguru", zone: "EC Phase 2", ward: "Hebbagodi" },
      { lat: 12.8302, lng: 77.6803, landmark: "Hebbagodi Main Road", zone: "Hebbagodi", ward: "Hebbagodi" },
      { lat: 12.8104, lng: 77.6991, landmark: "Bommasandra Industrial Area, Phase 1", zone: "Bommasandra", ward: "Attibele" },
    ],
  },
  {
    id: "ec-inner-roads",
    label: "EC Inner Roads - Konappana Agrahara Loop",
    waypoints: [
      { lat: 12.85, lng: 77.662, landmark: "Konappana Agrahara Main Road", zone: "EC Phase 1", ward: "Bommanahalli" },
      { lat: 12.8563, lng: 77.6482, landmark: "Doddathoguru Village Road", zone: "Doddathoguru", ward: "Bommanahalli" },
      { lat: 12.8231, lng: 77.6902, landmark: "Huskur Gate Service Road", zone: "Huskur", ward: "Attibele" },
      { lat: 12.8698, lng: 77.6441, landmark: "Beratena Agrahara Junction", zone: "Beratena Agrahara", ward: "Bommanahalli" },
    ],
  },
];

export const DEFAULT_ROUTE_ID = ROUTES[0].id;

export function routeById(id: string): PatrolRoute {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0];
}
