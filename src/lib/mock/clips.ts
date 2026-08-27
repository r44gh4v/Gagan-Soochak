/**
 * Bundled sample clips - the team's own dashcam test footage (the same clips
 * the Python edge pipeline was tested against, which keeps the parity story
 * honest). Each clip is bound to a patrol route so simulated GPS stays
 * deterministic per clip.
 */
export type SampleClip = {
  src: string;
  /** Shown in the picker. */
  label: string;
  /** Filename recorded on incident evidence. */
  file: string;
  routeId: string;
};

export const SAMPLE_CLIPS: SampleClip[] = [
  {
    src: "/videos/Test_1_Pothole.mp4",
    label: "Test 1",
    file: "Test_1_Pothole.mp4",
    routeId: "ec-hosur-road",
  },
  {
    src: "/videos/Test_2.mp4",
    label: "Test 2",
    file: "Test_2.mp4",
    routeId: "ec-inner-roads",
  },
];
