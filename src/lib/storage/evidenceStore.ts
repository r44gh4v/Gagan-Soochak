import { createStore, del, get, keys, set } from "idb-keyval";

/**
 * Evidence JPEGs live in IndexedDB, NOT localStorage - base64 frames would
 * blow the ~5 MB localStorage quota within a couple dozen incidents. Incident
 * metadata (small, serialisable) persists separately via zustand/persist.
 */
const store = createStore("gagan-soochak-evidence", "blobs");

export const thumbKey = (incidentId: string) => `evi:${incidentId}:thumb`;
export const frameKey = (incidentId: string) => `evi:${incidentId}:frame`;

export async function putEvidence(key: string, blob: Blob): Promise<void> {
  await set(key, blob, store);
}

export async function getEvidence(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, store);
}

export async function deleteIncidentEvidence(incidentId: string): Promise<void> {
  await Promise.all([del(thumbKey(incidentId), store), del(frameKey(incidentId), store)]);
}

export async function clearAllEvidence(): Promise<void> {
  const all = await keys(store);
  await Promise.all(all.map((k) => del(k, store)));
}
