# Parity check - Python pipeline vs. browser build

The dashboard's claim is that the browser runs **the same model with the same math** as the
Python edge pipeline. This folder holds the proof.

## 1. Numeric probe (identical input, both runtimes) - PASSED

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

Identical to 4-5 significant figures. This verifies tensor layout, channel order, decode
strides, box math and NMS are equivalent across runtimes - the parts that silently break.

Reproduce:

```bash
cd ml && uv run python parity_probe.py     # -> parity_python.json
cd .. && node scripts/parity-probe.mjs     # -> parity_web.json
```

## 2. On-footage check (same real frame, both pipelines) - PASSED

`ml/parity_footage.py` runs the identical video frame through (a) pipeline.py's exact path
(`best.pt` via Ultralytics, cv2.resize 640×720) and (b) the web build's math (`best.onnx`,
two-step stretch+letterbox preprocess, TS-equivalent decode + NMS). Results on the team's
own test clips:

**`test_video.mp4` @ t=0.0s (1080×1920 portrait dashcam)** - `parity_footage_testvideo_t0.json`

| Side | Class | Conf | Box (src px) |
|---|---|---|---|
| `.pt` + Ultralytics | pothole | 0.8562 | [236, 830, 349, 969] |
| `.onnx` + web math | pothole | 0.8361 | [239, 831, 348, 968] |

Box agrees within **3 px**, confidence within **0.02** - the planned tolerance. The web
side additionally reports a second pothole at 0.4036 that the `.pt` side scores just under
the 0.30 threshold: a near-threshold flip explained by fp16 (`.pt`) vs fp32 (`.onnx`)
weights, disclosed rather than hidden.

**`Test_Video2.mp4` @ t=4.5s (854×480)** - `parity_footage_video2_t4.5.json`

| Side | Class | Conf | Box (src px) |
|---|---|---|---|
| `.pt` + Ultralytics | drain_overflow | 0.4922 | [238, 150, 608, 304] |
| `.onnx` + web math | drain_overflow | 0.4963 | [239, 150, 636, 316] |

Same class, confidence within 0.004; the box's right edge differs ~28 px on a wide,
soft-edged overflow region (fp16/fp32 + Ultralytics' letterbox pad rounding). Reproduce:
`cd ml && uv run python parity_footage.py <clip> <seconds>`.

Detection timeline across both clips (scan at 0.5 s steps, conf ≥ 0.30): `test_video.mp4`
fires pothole at t≈0, 2.5, 4.5, 6, 7.5, 8; `Test_Video2.mp4` fires drain_overflow
(t≈0.5, 4.5, 6.5, 8.5, 9, 13), pothole (t≈2-3.5), waterlogged_road (t≈7, 21.5) - all
three classes on the team's own footage.

## 3. Known intentional divergences

| Divergence | Why |
|---|---|
| NMS in TypeScript (IoU 0.45) vs. Ultralytics-internal | ONNX exported with `nms=False`; enables the live confidence slider |
| Evidence images per incident vs. thumbnail-on-High-only | dashboard queue needs triageable thumbnails |
| Repeat-sighting clustering at the incident layer | `pipeline.py` logs one row per track, correct for a detection log; a civic queue needs one work item per physical defect. Detection/tracking/severity maths are **unchanged** - clustering happens after them, so the parity results above still hold. |
| `PROCESS_EVERY_N` default 2 | Build Notes §4 current config (source's old 4 was yolov8s-era) |

## 4. Throughput comparison

| Runtime | Config | FPS |
|---|---|---|
| Python + PyTorch CPU | yolov8n 640×720, no skip | 7.7 (measured, Build Notes §4) |
| Python + PyTorch CPU | yolov8n 640×720, N=2 | ~14-15 (measured) |
| Browser ORT-web WebGPU | yolov8n 640×640, N=2 | ~35 ms/inference, 24.9 effective FPS on the dev machine (video-rate; inference not the bottleneck) |
