# Model comparison — `best.pt` (shipped) vs `better.pt` (evaluated, rejected)

A larger YOLOv8s checkpoint (`better.pt`) was evaluated as a replacement for the shipped
YOLOv8n (`best.pt`). It is genuinely better at potholes — and it was **not adopted**, because
it cannot detect drain overflow at all.

Reproduce: `cd ml && uv run python compare_models.py` (both clips sampled every 0.5 s at the
shipped `conf 0.30`, pipeline preprocessing).

## The blocker

| | `best.pt` — shipped | `better.pt` — rejected |
|---|---|---|
| Classes | pothole, waterlogged_road, **drain_overflow** | pothole, waterlogged_road |
| Track coverage | 3 of 4 | **2 of 4** |

Track 2 names drainage overflow as a detection target. `better.pt` has `nc=2` — the class
does not exist in the head, so no threshold or tuning can recover it. Adopting it would drop
a required capability, remove the BWSSB routing path (three departments become two), and
delete our strongest evidence case (`INC-2026-0004`, the High-severity drain eruption).

## Measured head-to-head

| Metric | `best.pt` | `better.pt` | Δ |
|---|---|---|---|
| Architecture | YOLOv8n | YOLOv8s | — |
| Parameters | 3.01 M | 11.14 M | 3.7× |
| ONNX size (fp32) | **12.3 MB** | 44.7 MB | 3.6× larger |
| ONNX output | `[1, 7, 8400]` | `[1, 6, 8400]` | breaks decode |
| ONNX CPU latency | **30 ms** | 90 ms | **3× slower** |
| Ultralytics CPU/frame | **379 ms** | 816 ms | 2.2× slower |

### Detections — `Test_1_Pothole.mp4` (18 frames sampled)

| Class | `best.pt` | `better.pt` |
|---|---|---|
| pothole | 8 · mean 0.532 · max 0.856 | **24 · mean 0.588 · max 0.871** |
| waterlogged_road | 0 | 1 · 0.406 |

**`better.pt` wins here decisively** — 3× the pothole detections at higher confidence. On the
frame at 4.3 s it finds a second genuine pothole further up the road that `best.pt` misses
(`potholeclip_*.jpg`). Pothole recall is the clearest weakness of the shipped model.

### Detections — `Test_2.mp4` (45 frames sampled, drain eruption flooding a street)

| Class | `best.pt` | `better.pt` |
|---|---|---|
| drain_overflow | **6 · mean 0.409 · max 0.492** | **class does not exist** |
| pothole | 4 · mean 0.393 | 30 · mean 0.456 |
| waterlogged_road | 2 · mean 0.328 | 1 · **mean 0.578** |

`better.pt` reports **30 pothole detections on a clip with no potholes** — 7.5× the shipped
model. With no drain class available, turbulent brown water lands on the nearest learned
concept, "dark irregular patch on road". Those are false alerts that would route to BBMP
Roads instead of BWSSB — the wrong department for a sewage-mix hazard.

`drainclip_best_3class.jpg` vs `drainclip_better_2class.jpg` shows it plainly: the shipped
model boxes the eruption as `drain_overflow 0.51`; the larger model boxes the flood as
`waterlogged_road 0.58` (correctly, and at higher confidence) but **misses the eruption
entirely**.

## Decision

**Keep `best.pt`.** The larger model trades a required class, 3× inference latency and a 3.6×
bigger browser download for better pothole recall. For a browser-delivered, CPU-fallback
dashboard judged on covering the track's hazard types, that trade is clearly negative.

## What would actually be better

Retrain the YOLOv8s configuration **with all three classes**. That would keep `better.pt`'s
pothole recall and restore drain overflow. The cost to weigh then is the 44.7 MB download and
3× latency — acceptable on WebGPU, marginal on the WASM fallback, and it would need
re-measuring before adoption. This is the single highest-value model change available and is
recorded in future scope.

## Reproducing

```bash
cd ml
# place the candidate checkpoint as ml/better.pt (gitignored, 22.5 MB)
uv run python compare_models.py   # -> model_comparison.json
uv run python viz_compare.py      # -> annotated cmp_*.jpg frames
```
