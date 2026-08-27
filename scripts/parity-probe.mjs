// TypeScript-path parity probe: runs the SAME deterministic tensor through
// best.onnx via onnxruntime-web (wasm, in Node) and decodes with the same
// math as src/lib/model/postprocess.ts. Compare output to ml/parity_python.json.
//
// Run:  node scripts/parity-probe.mjs   ->  ml/parity_web.json

import { readFileSync, writeFileSync } from "node:fs";
import * as ort from "onnxruntime-web";

const SIZE = 640;
const CONF = 0.25;
const IOU = 0.45;
const ANCHORS = 8400;

function lcgImage() {
  const n = 3 * SIZE * SIZE;
  const out = new Float32Array(n);
  let state = 123456789n;
  const A = 1103515245n, C = 12345n, M = 0x7fffffffn;
  for (let i = 0; i < n; i++) {
    state = (A * state + C) & M;
    out[i] = Number(state % 256n) / 255;
  }
  return out;
}

function iou(a, b) {
  const ix1 = Math.max(a[0], b[0]), iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]), iy2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  if (!inter) return 0;
  const ua =
    (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return inter / ua;
}

function decode(out) {
  const cands = [];
  for (let i = 0; i < ANCHORS; i++) {
    let best = 0, cls = -1;
    for (let c = 0; c < 3; c++) {
      const s = out[(4 + c) * ANCHORS + i];
      if (s > best) { best = s; cls = c; }
    }
    if (best < CONF) continue;
    const cx = out[i], cy = out[ANCHORS + i], w = out[2 * ANCHORS + i], h = out[3 * ANCHORS + i];
    cands.push({ cls, conf: best, box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] });
  }
  const kept = [];
  for (let c = 0; c < 3; c++) {
    const clsC = cands.filter((d) => d.cls === c).sort((a, b) => b.conf - a.conf);
    const sup = new Array(clsC.length).fill(false);
    for (let i = 0; i < clsC.length; i++) {
      if (sup[i]) continue;
      kept.push(clsC[i]);
      for (let j = i + 1; j < clsC.length; j++) {
        if (!sup[j] && iou(clsC[i].box, clsC[j].box) > IOU) sup[j] = true;
      }
    }
  }
  kept.sort((a, b) => b.conf - a.conf);
  return kept.map((d) => ({
    cls: d.cls,
    conf: +d.conf.toFixed(5),
    box: d.box.map((v) => +v.toFixed(2)),
  }));
}

const buf = readFileSync("public/models/best.onnx");
const session = await ort.InferenceSession.create(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
  executionProviders: ["wasm"],
});
const data = lcgImage();
const input = new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]);
const { output0 } = await session.run({ images: input });
const y = output0.data;

let sum = 0;
for (let i = 0; i < y.length; i++) sum += y[i];
let boxSum = 0;
for (let i = 0; i < 4 * ANCHORS; i++) boxSum += y[i];
let scoreMax = 0, scoreSum = 0;
for (let i = 4 * ANCHORS; i < 7 * ANCHORS; i++) {
  scoreSum += y[i];
  if (y[i] > scoreMax) scoreMax = y[i];
}
let inputSum = 0;
for (let i = 0; i < data.length; i++) inputSum += data[i];

const result = {
  inputChecksum: +inputSum.toFixed(2),
  outputShape: [1, 7, ANCHORS],
  outputStats: {
    sum: +sum.toFixed(1),
    boxMean: +(boxSum / (4 * ANCHORS)).toFixed(4),
    scoreMax: +scoreMax.toFixed(5),
    scoreMean: +(scoreSum / (3 * ANCHORS)).toFixed(6),
  },
  detections: decode(y),
};
writeFileSync("ml/parity_web.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
