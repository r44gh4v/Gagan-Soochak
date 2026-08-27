import { CLASSES, NMS_IOU, RESIZE_DIM } from "@/lib/detection/constants";
import type { BBox, Detection, PreMeta } from "@/lib/model/types";

const NUM_CLASSES = CLASSES.length;
const NUM_ANCHORS = 8400;

/**
 * Decode YOLOv8 raw output [1, 7, 8400] (channel-major: anchor i's cx is at
 * out[0*8400+i], scores at out[(4+c)*8400+i], already sigmoid'd - verified by
 * ml/verify_onnx.py) into detections in source-frame pixels.
 *
 * Box mapping inverts the two-step preprocess:
 *   model 640×640 → un-letterbox → 640×720 space → scale by (srcW/640, srcH/720)
 * mirroring pipeline.py L279-L295. The aspect distortion of step 1 cancels
 * out here, which is why logged coordinates stay correct.
 */
export function decode(
  output: Float32Array,
  meta: PreMeta,
  confThreshold: number,
  iouThreshold: number = NMS_IOU,
): Detection[] {
  const candidates: Detection[] = [];
  const sx = meta.srcW / RESIZE_DIM.w;
  const sy = meta.srcH / RESIZE_DIM.h;

  for (let i = 0; i < NUM_ANCHORS; i++) {
    let best = 0;
    let bestClass = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const s = output[(4 + c) * NUM_ANCHORS + i];
      if (s > best) {
        best = s;
        bestClass = c;
      }
    }
    if (best < confThreshold) continue;

    const cx = output[i];
    const cy = output[NUM_ANCHORS + i];
    const w = output[2 * NUM_ANCHORS + i];
    const h = output[3 * NUM_ANCHORS + i];

    // cxcywh → xyxy in model space, un-letterbox to 640×720, then to source px
    const x1 = clamp(((cx - w / 2 - meta.padX) / meta.scale) * sx, 0, meta.srcW);
    const y1 = clamp(((cy - h / 2 - meta.padY) / meta.scale) * sy, 0, meta.srcH);
    const x2 = clamp(((cx + w / 2 - meta.padX) / meta.scale) * sx, 0, meta.srcW);
    const y2 = clamp(((cy + h / 2 - meta.padY) / meta.scale) * sy, 0, meta.srcH);
    if (x2 - x1 < 1 || y2 - y1 < 1) continue;

    candidates.push({
      classId: bestClass,
      className: CLASSES[bestClass],
      confidence: best,
      bbox: [x1, y1, x2, y2],
    });
  }

  return nmsPerClass(candidates, iouThreshold);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function iou(a: BBox, b: BBox): number {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter === 0) return 0;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

/** Greedy per-class NMS, highest confidence first. */
function nmsPerClass(dets: Detection[], iouThreshold: number): Detection[] {
  const kept: Detection[] = [];
  for (let c = 0; c < NUM_CLASSES; c++) {
    const cls = dets
      .filter((d) => d.classId === c)
      .sort((a, b) => b.confidence - a.confidence);
    const suppressed = new Array<boolean>(cls.length).fill(false);
    for (let i = 0; i < cls.length; i++) {
      if (suppressed[i]) continue;
      kept.push(cls[i]);
      for (let j = i + 1; j < cls.length; j++) {
        if (!suppressed[j] && iou(cls[i].bbox, cls[j].bbox) > iouThreshold) {
          suppressed[j] = true;
        }
      }
    }
  }
  return kept.sort((a, b) => b.confidence - a.confidence);
}
