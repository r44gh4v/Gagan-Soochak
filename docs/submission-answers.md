# Submission Form - pre-drafted answers

> Draft answers for the "Top 15 to Top 5 Technical Build Submission" Google Form.
> Fill the blanks (URLs, names, final measured numbers) before submitting.
> Rule for every field: report what was measured, never round upward.

## Section 1 - Team details

- **Team name:** DuoQueue
- **Project title:** Gagan Soochak - On-device monsoon-hazard detection & civic repair workflow
- **One sentence:** Detects potholes, waterlogging and drain overflow from road video
  entirely on the operator's device, and drives each detection through a BBMP/BWSSB repair
  workflow from evidence capture to verified closure.

## Section 2 - Technical submission

- **GitHub URL:** https://github.com/r44gh4v/Gagan-Soochak
- **Final commit hash:** _(pin at submission)_
- **Video URL:** _(≤5 min, team member speaking over the live app)_
- **Dashboard URL:** _(Vercel)_

## Section 3 - Current build status

**Working today (≤150 words):**
On-device YOLOv8n inference in the browser via ONNX Runtime Web (WebGPU with threaded-WASM
fallback) - model downloads once (~12 MB), cached, works offline. Three-class detection with
real confidences and measured latency (~35 ms/frame on our dev machine). Centroid tracker
with temporal severity scoring, ported verbatim from our Python edge pipeline with a
numerically verified parity probe. Auto-generated incidents with full evidence fields;
filterable operator queue with bulk actions and evidence cards; per-incident lifecycle
open → assigned → in progress → resolved → verified closed, plus reject-as-false-positive
and manual escalation with priority bump; audit trail on every change; department
auto-routing (BBMP Roads / BBMP SWD / BWSSB); class×severity response playbook; JSON/CSV
export; analytics with live session metrics; file-upload path so judges can run their own
footage.

**Simulated/mocked/configured (≤100 words):**
GPS coordinates are interpolated along pre-defined Electronic City patrol routes and badged
SIMULATED in the UI and exports. Timestamps derive from an operator-set patrol start plus
video timecode (badged DERIVED). Department, crew and contact names are representative, not
live municipal integrations. SLA hours are displayed guidance, not enforced timers. Bundled
footage is pre-recorded, not a live drone feed. Optional seeded demo incidents are labelled
SEED DATA. All detections, severity scores, confidences and latencies are measured, not
fabricated.

**Future scope (≤100 words):**
damaged_footpath - the fourth track class - was prepared but is not in the shipped model:
adding a fourth class to a single all-in-one detector pushed it past our CPU real-time
budget, so we shipped three classes that run in real time on-device instead. The merge
pipeline supports adding it via a new source + class map + retrain. Then:
live drone/RTSP ingest; OpenVINO/INT8 CPU export and Jetson+TensorRT edge deployment;
ByteTrack-style re-ID tracking; real GPS/telemetry binding; multi-operator server database;
automated SLA timers and auto-escalation; municipal ticketing integration; a retraining loop
fed by operator rejections.

**New since proposal (≤100 words):**
The entire civic workflow layer and a browser-native inference path. The proposal had a
Python script writing to SQLite with an OpenCV preview; the jury can now open a URL, watch
the model download to their own machine, run detection on their own footage, and drive an
incident from detection to verified closure with an audit trail - no installation.

## Section 4 - Testing & evidence

**Best measurable result:**
Validation mAP50 (20% held-out): pothole 0.893, waterlogged_road 0.743, drain_overflow
0.720 - all clear the proposal's 0.70 target. drain_overflow is measured over ~16 validation
instances (thin class; wide error bars - stated up front). Runtime: ~35 ms/frame browser
inference (WebGPU, dev machine), video-rate 24.9 effective FPS at N=2; Python CPU baseline
7.7 FPS unskipped / ~14-15 at N=2. Runtime parity: identical model output across Python and
browser to 4-5 significant figures (evidence/parity_check.md).
_(Add measured false-alert rate from a hand-labelled clip before submitting - see
evidence/cases.md.)_

- **Evidence folder:** `evidence/` in the repo
- **3 successes + 2 failures:** `evidence/cases.md`
- **Biggest limitation:** drain_overflow trained on ~80 images (mAP50 0.720 over ~16
  validation instances) - the least reliable class, and the reason the workflow has a
  first-class Reject action.

## Section 5 - Dataset

- **What data:** Public dataset (Roboflow Universe) ✔ / Self-recorded footage ✔ (test clips)
- **Sources:** Roboflow Universe - `o-v8` (pothole, 608 img), `kk1` (waterlogged/`puddle`
  remapped, 1,499 img), `chaitanya-kharche/drain-overflow` (302 img, overflow classes only →
  ~80 kept)
- **Amount:** ~2,409 raw images before filtering; 80/20 train/val split.
  _(Recount `dataset/images/{train,val}` on the training machine and publish the verified
  post-merge number.)_
- **Personally annotated:** None (curation + class-remapping of public datasets).

## Section 6 - Team ownership

- **Member 1:** _(name - ML: datasets, training runs, pipeline.py, export)_
- **Member 2:** _(name - dashboard: inference worker, workflow, UI)_
- **Most confident demonstrating live:** the full detect → evidence → assign → close flow on
  a judge-supplied video, including going offline to prove on-device inference.

## Q&A answers to rehearse

- *"You tried ONNX and it didn't help?"* - That was `onnxruntime-gpu` on a CPU-only laptop -
  a packaging mistake, not an ONNX limitation. OpenVINO is the CPU edge path; ONNX Runtime
  Web is the only browser path. One model, two runtimes, parity-verified.
- *"Why is drain_overflow's number trustworthy?"* - It isn't, fully: 0.720 over ~16 val
  instances. That's why we quote the sample size, why the threshold is permissive, and why
  Reject is a first-class operator action.
- *"Only 3 classes?"* - damaged_footpath was prepared, but as a fourth class in one
  all-in-one detector it broke the CPU real-time budget we committed to; we chose three
  classes running in real time on-device over four that don't. We claim no accuracy figure
  for it because none was measured on a shipped model. The merge pipeline is
  built for adding it.
- *"What happens with five operators?"* - Client-side persistence is a deliberate choice for
  this evaluation; `Incident` is a plain serialisable object and the store boundary is the
  single swap point for a server API.
