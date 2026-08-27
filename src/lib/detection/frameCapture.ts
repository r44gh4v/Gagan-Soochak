import { CLASS_LABELS, SEVERITY_STROKE } from "@/lib/detection/constants";
import type { TrackedHazard } from "@/lib/detection/tracker";

/**
 * Captures both evidence artifacts for an incident:
 *  - thumbnail: bbox crop with 15% padding, ≤320 px wide (queue triage)
 *  - frame: full frame ≤640 px wide with box + label drawn on (evidence card)
 *
 * pipeline.py only saves an unannotated full frame on the first High crossing;
 * capturing both per incident is a deliberate dashboard improvement, not a
 * parity claim. Downscaling + JPEG keeps IndexedDB well under quota.
 */
export async function captureEvidence(
  video: HTMLVideoElement,
  hazard: TrackedHazard,
): Promise<{ thumbnail: Blob; frame: Blob }> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const [x1, y1, x2, y2] = hazard.bbox;

  // --- thumbnail: padded crop ---
  const padW = (x2 - x1) * 0.15;
  const padH = (y2 - y1) * 0.15;
  const cx1 = Math.max(0, x1 - padW);
  const cy1 = Math.max(0, y1 - padH);
  const cw = Math.min(vw, x2 + padW) - cx1;
  const ch = Math.min(vh, y2 + padH) - cy1;
  const tScale = Math.min(1, 320 / cw);

  const thumbCanvas = new OffscreenCanvas(
    Math.max(1, Math.round(cw * tScale)),
    Math.max(1, Math.round(ch * tScale)),
  );
  thumbCanvas
    .getContext("2d")!
    .drawImage(video, cx1, cy1, cw, ch, 0, 0, thumbCanvas.width, thumbCanvas.height);

  // --- annotated full frame ---
  const fScale = Math.min(1, 640 / vw);
  const frameCanvas = new OffscreenCanvas(
    Math.round(vw * fScale),
    Math.round(vh * fScale),
  );
  const fc = frameCanvas.getContext("2d")!;
  fc.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);

  const stroke = SEVERITY_STROKE[hazard.severity.level];
  fc.strokeStyle = stroke;
  fc.lineWidth = 2;
  fc.strokeRect(
    x1 * fScale,
    y1 * fScale,
    (x2 - x1) * fScale,
    (y2 - y1) * fScale,
  );
  const label = `${CLASS_LABELS[hazard.className]} ${hazard.confidence.toFixed(2)} (${hazard.severity.level})`;
  fc.font = "600 12px system-ui, sans-serif";
  const tw = fc.measureText(label).width;
  const lx = x1 * fScale;
  const ly = Math.max(16, y1 * fScale - 4);
  fc.fillStyle = stroke;
  fc.fillRect(lx, ly - 12, tw + 8, 16);
  fc.fillStyle = "#ffffff";
  fc.fillText(label, lx + 4, ly);

  const [thumbnail, frame] = await Promise.all([
    thumbCanvas.convertToBlob({ type: "image/jpeg", quality: 0.75 }),
    frameCanvas.convertToBlob({ type: "image/jpeg", quality: 0.7 }),
  ]);
  return { thumbnail, frame };
}
