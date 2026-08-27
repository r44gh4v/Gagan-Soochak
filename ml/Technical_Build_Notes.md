# DuoQueue — Technical Build Notes

> ELCIA Smart City Drone-AI Challenge 2026 — Monsoon, Roads & Civic Infrastructure Intelligence
>
> Markdown conversion of the team's authoritative build record (`Technical Build Notes.pdf`).
> This document tracks what was built, why key decisions were made, the actual measured
> numbers, and what's left to do.

## 1. What We're Detecting

Three hazard classes from road/CCTV/drone video:

- **Pothole**
- **Waterlogged road**
- **Drain overflow**

(A fourth class, `damaged_footpath`, is planned but not yet sourced/annotated — see Section 6.)

## 2. Datasets

| Class | Source | Notes |
|---|---|---|
| Pothole | Roboflow Universe — `o-v8` | 608 images, largest/strongest source |
| Waterlogged road | Roboflow Universe — `kk1` | 1,499 images, class name `puddle` remapped to `waterlogged_road` |
| Drain overflow | Roboflow Universe — `chaitanya-kharche/drain-overflow` | 302 images total, only the "overflowing" classes kept (others dropped); thinnest class — only ~16 validation instances |

All three merged into one dataset via `3_merge_and_split.py`, with an 80/20 train/val split,
and a `class_map` per source to remap/drop classes that didn't match our 3-class taxonomy.

**Key design decision:** each class was annotated completely separately (different people,
different Roboflow projects, different times), then merged into a single unified dataset for
training. Separate annotation + one combined model is not a contradiction — that's the
intended workflow, and it's what let us add `drain_overflow` late without redoing
pothole/waterlogged work.

## 3. Model Training — Two Runs

### Run 1: YOLOv8s (small)

100 epochs, Colab T4 GPU, 1.5 hours.

| Class | mAP50 |
|---|---|
| pothole | 0.909 |
| waterlogged_road | 0.734 |
| drain_overflow | 0.773 |

All three cleared the proposal's 0.70 target. **But** CPU inference speed came in at only
~3–6 FPS on a real laptop — well under the proposal's 10 FPS commitment.

### Run 2: YOLOv8n (nano) — final choice

Switched to the smaller/faster nano variant specifically because ELCIA's use case is drone +
CCTV footage — a moving camera can't afford to skip many frames without risking missed
hazards (see Section 4). Retrained 100 epochs, Colab T4.

| Class | mAP50 | vs. yolov8s |
|---|---|---|
| pothole | 0.893 | −0.016 |
| waterlogged_road | 0.743 | +0.009 |
| drain_overflow | 0.720 | −0.053 (thin margin — watch this one) |

All three still clear 0.70. `drain_overflow` is the one to keep an eye on — it has the
smallest validation set (16 images), so this number has real variance; a few more annotated
examples would firm it up meaningfully more than any other single improvement right now.

**Model size:** 22.5 MB (yolov8s) → 6.1–6.3 MB (yolov8n).

## 4. CPU Inference Speed & Frame-Skipping

The proposal commits to ≥10 FPS on CPU-only inference (no GPU assumed at deployment).
Measured real numbers, on an actual laptop (not Colab):

| Model | Resolution | Frame-skipping | Measured FPS |
|---|---|---|---|
| yolov8s | 1280×720 | none | ~2.6–4.7 (noisy) |
| yolov8s | 640×720 | none | ~3.5 |
| yolov8s | 640×720 | every 4th frame | 11.4 |
| yolov8n | 640×720 | none | **7.7** |
| yolov8n | 640×720 | every 2nd frame (est.) | ~14–15 |

**Current config:** `PROCESS_EVERY_N = 2` in `pipeline.py` — every 2nd frame is actually run
through the model; the frame in between reuses the last known detection (drawn, not
re-detected).

**Why this is still acceptable for a moving drone:** at 25–30 FPS source video, skipping
every 2nd frame still means inference runs 12–15 times per second. A hazard would need to
cross the entire frame in well under a tenth of a second to be missed outright. This is a
deliberate, disclosed engineering tradeoff, not a shortcut.

**Procedure to eliminate frame-skipping (next stage), in rough effort/impact order:**

1. **Export to OpenVINO format** — Intel's CPU-specific optimizer. (An earlier ONNX attempt
   used the wrong GPU-oriented runtime package on a CPU machine and didn't help — a
   packaging mistake, not an ONNX limitation. The browser dashboard uses ONNX Runtime Web,
   a different target entirely.)
2. **INT8 quantization** on top of the OpenVINO export — test whether the mAP drop is
   acceptable, especially for the thin `drain_overflow` class.
3. **Test on actual deployment hardware** — if ELCIA's setup has any edge GPU (Jetson-class),
   frame-skipping may not be needed at all.
4. **Multi-thread capture vs. inference** — producer/consumer queue to remove I/O wait.
5. **Re-benchmark after each step** with `speed_test.py` — measure, don't guess.

## 5. Pipeline Architecture (`pipeline.py`)

- **Video input:** any source `cv2.VideoCapture` accepts — file, webcam index, or RTSP
  stream. No code changes between a demo video and a real CCTV feed.
- **Severity formula** (from the proposal, implemented exactly):
  `0.6 × (bbox_area / frame_area) + 0.4 × min(consecutive, DETECTION_WINDOW) / DETECTION_WINDOW`
- **Hazard tracking:** lightweight tracker links the same physical hazard across frames.
  Originally matched by IoU — this failed on moving-camera footage, since the same hazard's
  box shifts position between frames. Fixed to match by **centroid distance** (within 15% of
  the frame diagonal).
- **Incident logging:** every tracked hazard is logged to `incidents.db` (SQLite) the moment
  it's first seen, at whatever severity it starts at — not just High ones. Its row is updated
  in place as severity changes.
- **Alerts:** a hazard fires a one-time alert (console flag + saved thumbnail) the first time
  it crosses into High severity.
- **Live preview:** boxes are drawn from the tracker's memory of active hazards on every
  frame (not just processed ones), colored by severity (green/orange/red).
- **Known display tradeoff:** box position only updates on processed frames — cosmetic lag
  only, doesn't affect detection/logging.

## 6. Open Items / Not Done Yet

- `damaged_footpath` as a 4th class — not yet sourced or annotated. Same workflow as the
  other three: annotate separately, add to `3_merge_and_split.py`'s `SOURCES` and
  `TARGET_CLASSES`, retrain.
- Frame-skipping still active (`PROCESS_EVERY_N = 2`) — see elimination procedure above.
- ~~Dashboard~~ — **done**: the Next.js operator dashboard in this repository (browser-native
  ONNX inference, superseding the original Streamlit plan).
- GitHub repo + README + demo video — this repository.
- Testing on real ELCIA-provided footage — all testing so far has used downloaded demo reels
  or self-recorded test clips, not official sample footage.

## 7. Known Limitations

- `drain_overflow` trained on a limited sample (~80 images post-filtering); mAP50 (0.720) is
  close to the target threshold and may not generalize as reliably as the other two classes.
- Inference runs on every 2nd frame rather than every frame, to meet the CPU real-time
  target — a deliberate tradeoff, not a bug (see Section 4).
- Hazard tracking uses simple centroid-distance matching, not a full multi-object tracker
  (no Kalman filter, no re-identification) — could confuse two very close hazards of the
  same class.
- All testing to date has used personal/downloaded footage, not official ELCIA-provided
  sample footage.
