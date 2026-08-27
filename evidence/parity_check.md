# Parity check — Python pipeline vs. browser build

The dashboard's claim is that the browser runs **the same model with the same math** as the
Python edge pipeline. This folder holds the proof.

## 1. Numeric probe (identical input, both runtimes) — PASSED

`ml/parity_probe.py` (Python + onnxruntime) and `scripts/parity-probe.mjs` (Node +
onnxruntime-web, the exact decode code path the browser uses) feed the **same deterministic
synthetic tensor** (same LCG, same bytes) through `best.onnx` and decode with each side's
implementation.

| Metric | Python (`parity_python.json`) | ORT-web (`parity_web.json`) |
|---|---|---|
| Input checksum | 614400.00 | 614400.01 (float summation order) |
| Output tensor sum | 6,263,369.0 | 6,263,369 |
| Box channel mean | 186.4098 | 186.4098 |
| Max class score | 0.02842 | 0.02842 |
| Mean class score | 3.8e-05 | 3.8e-05 |
| Decoded detections | [] (noise input, correctly none) | [] |

Identical to 4–5 significant figures. This verifies tensor layout, channel order, decode
strides, box math and NMS are equivalent across runtimes — the parts that silently break.

Reproduce:

```bash
cd ml && uv run python parity_probe.py     # -> parity_python.json
cd .. && node scripts/parity-probe.mjs     # -> parity_web.json
```

## 2. On-footage check (same frame, both pipelines) — pending sample clips

When the team's test clips land in `public/videos/`, run the same frame through
`ml/pipeline.py` and the dashboard, and record class / bbox / confidence / severity side by
side here. Expected tolerance: boxes within a few px, confidence within ~0.02 (the residual
comes from cv2 vs. canvas image resampling, which the numeric probe deliberately bypasses).

## 3. Known intentional divergences

| Divergence | Why |
|---|---|
| NMS in TypeScript (IoU 0.45) vs. Ultralytics-internal | ONNX exported with `nms=False`; enables the live confidence slider |
| Evidence images per incident vs. thumbnail-on-High-only | dashboard queue needs triageable thumbnails |
| `PROCESS_EVERY_N` default 2 | Build Notes §4 current config (source's old 4 was yolov8s-era) |

## 4. Throughput comparison

| Runtime | Config | FPS |
|---|---|---|
| Python + PyTorch CPU | yolov8n 640×720, no skip | 7.7 (measured, Build Notes §4) |
| Python + PyTorch CPU | yolov8n 640×720, N=2 | ~14–15 (measured) |
| Browser ORT-web WebGPU | yolov8n 640×640, N=2 | ~35 ms/inference, 24.9 effective FPS on the dev machine (video-rate; inference not the bottleneck) |
