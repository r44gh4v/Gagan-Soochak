import { INPUT_SIZE, RESIZE_DIM } from "@/lib/detection/constants";
import type { PreMeta } from "@/lib/model/types";

/**
 * Replicates pipeline.py's exact two-step transform:
 *
 *   1. cv2.resize(frame, (640, 720))  — stretch, aspect DELIBERATELY distorted
 *   2. Ultralytics letterbox 640×720 → 640×640 (aspect preserved, gray 114 pad)
 *
 * The intuitive single letterbox of the source frame is WRONG here — the
 * model was always fed the stretched intermediate, so skipping step 1 would
 * produce genuinely different detections and silently break parity with the
 * Python pipeline. Both steps compose into one drawImage call below.
 */

const PAD_GRAY = "rgb(114,114,114)";

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

export function preprocess(bmp: ImageBitmap): { data: Float32Array; meta: PreMeta } {
  const scale = Math.min(INPUT_SIZE / RESIZE_DIM.w, INPUT_SIZE / RESIZE_DIM.h);
  const drawW = Math.round(RESIZE_DIM.w * scale);
  const drawH = Math.round(RESIZE_DIM.h * scale);
  const padX = (INPUT_SIZE - drawW) / 2;
  const padY = (INPUT_SIZE - drawH) / 2;

  if (!canvas) {
    canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  const c = ctx!;
  c.fillStyle = PAD_GRAY;
  c.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  // stretch-to-640×720 then uniform letterbox scale, composed into one draw
  c.drawImage(bmp, 0, 0, bmp.width, bmp.height, padX, padY, drawW, drawH);

  const { data: rgba } = c.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  // RGBA u8 → RGB f32 /255, HWC → CHW
  const area = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    const j = i * 4;
    out[i] = rgba[j] / 255;
    out[area + i] = rgba[j + 1] / 255;
    out[2 * area + i] = rgba[j + 2] / 255;
  }

  return {
    data: out,
    meta: { scale, padX, padY, srcW: bmp.width, srcH: bmp.height },
  };
}
