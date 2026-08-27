/**
 * Bundled sample clips. Files live in public/videos/ (kept ≤10 MB each,
 * H.264). Each clip is bound to a patrol route so simulated GPS stays
 * deterministic per clip.
 */
export type SampleClip = {
  src: string;
  label: string;
  routeId: string;
};

export const SAMPLE_CLIPS: SampleClip[] = [
  {
    src: "/videos/sample-1.mp4",
    label: "sample-1.mp4 — Hosur Road patrol",
    routeId: "ec-hosur-road",
  },
  {
    src: "/videos/sample-2.mp4",
    label: "sample-2.mp4 — EC inner roads patrol",
    routeId: "ec-inner-roads",
  },
];
