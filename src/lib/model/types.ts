import type { HazardClass } from "@/lib/detection/constants";

/** Bounding box in source-frame pixels, [x1, y1, x2, y2]. */
export type BBox = [number, number, number, number];

export type Detection = {
  classId: number;
  className: HazardClass;
  confidence: number;
  bbox: BBox;
};

/**
 * Geometry of the two-step preprocess (stretch to 640×720, then letterbox
 * to 640×640), needed to map model-space boxes back to source pixels.
 */
export type PreMeta = {
  /** 640×720 → 640×640 letterbox scale (min(640/640, 640/720) ≈ 0.889). */
  scale: number;
  /** Letterbox padding in model space. */
  padX: number;
  padY: number;
  /** Original frame dims — final rescale from 640×720 space to source px. */
  srcW: number;
  srcH: number;
};

export type WorkerRequest =
  | { type: "init"; buffer: ArrayBuffer }
  | { type: "infer"; id: number; bitmap: ImageBitmap; conf: number };

export type WorkerResponse =
  | { type: "ready"; backend: "webgpu" | "wasm" }
  | {
      type: "result";
      id: number;
      detections: Detection[];
      inferenceMs: number;
      srcW: number;
      srcH: number;
    }
  | { type: "error"; message: string };
