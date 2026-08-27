/**
 * Bundled sample clips - the team's own dashcam test footage (the same clips
 * the Python edge pipeline was tested against, which keeps the parity story
 * honest). Each clip is bound to a patrol route so simulated GPS stays
 * deterministic per clip.
 */
export type SampleClip = {
  src: string;
  label: string;
  routeId: string;
};

export const SAMPLE_CLIPS: SampleClip[] = [
  {
    src: "/videos/test_video.mp4",
    label: "test_video.mp4 - Hosur Road patrol",
    routeId: "ec-hosur-road",
  },
  {
    src: "/videos/Test_Video2.mp4",
    label: "Test_Video2.mp4 - EC inner roads patrol",
    routeId: "ec-inner-roads",
  },
];
