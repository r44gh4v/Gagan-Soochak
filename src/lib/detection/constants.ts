/**
 * Single source of truth for every detection/severity tunable.
 * Values are transcribed verbatim from ml/pipeline.py (the Python edge
 * pipeline) so the browser build and the edge build compute identical
 * numbers on identical frames. Do not change one side without the other.
 */

export const MODEL_URL = "/models/best.onnx";
export const MODEL_CACHE = "gagan-soochak-model-v1";

/** Model input side (Ultralytics imgsz used at training + export). */
export const INPUT_SIZE = 640;

/** pipeline.py L43 — step 1 of preprocessing stretches to this (w × h). */
export const RESIZE_DIM = { w: 640, h: 720 } as const;

export const CLASSES = ["pothole", "waterlogged_road", "drain_overflow"] as const;
export type HazardClass = (typeof CLASSES)[number];

export const CLASS_LABELS: Record<HazardClass, string> = {
  pothole: "Pothole",
  waterlogged_road: "Waterlogged Road",
  drain_overflow: "Drain Overflow",
};

/** pipeline.py L46 — detections below this confidence are noise. */
export const CONF_THRESHOLD = 0.3;

/**
 * Web-only: the ONNX export uses nms=False (ORT-web's fused-NMS support is
 * unreliable), so NMS runs in TypeScript. The Python side gets NMS from
 * Ultralytics internally with this same default IoU.
 */
export const NMS_IOU = 0.45;

/**
 * Process every Nth frame. pipeline.py L42 still says 4, but that comment
 * block cites yolov8s-era FPS numbers; Technical Build Notes §4 records the
 * current nano config as 2 (~12-15 Hz effective sampling).
 */
export const PROCESS_EVERY_N = 2;

/** pipeline.py L51 — processed frames for the temporal term to max out. */
export const DETECTION_WINDOW = 10;

/** pipeline.py L59 — centroid match radius, fraction of frame diagonal. */
export const MATCH_DISTANCE_THRESHOLD = 0.15;

/** pipeline.py L63 — unmatched processed frames before a hazard expires. */
export const HAZARD_EXPIRE_GAP = 5;

/** pipeline.py L182 — severity = 0.6·spatial + 0.4·temporal. */
export const SEVERITY_SPATIAL_WEIGHT = 0.6;
export const SEVERITY_TEMPORAL_WEIGHT = 0.4;

/** pipeline.py L66-70 — order matters: first threshold met wins. */
export const SEVERITY_LEVELS = [
  [0.6, "High"],
  [0.3, "Medium"],
  [0.0, "Low"],
] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number][1];

export const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  High: 2,
  Medium: 1,
  Low: 0,
};

/** Same hex on canvas strokes and UI chips — video and queue read as one system. */
export const SEVERITY_STROKE: Record<SeverityLevel, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#059669",
};
