# ELCIA Top 15 → Top 5 — Submission Form Answers

Copy-paste ready. Fields marked **[FILL]** need a human — URLs, names, the final commit
hash. Everything else is measured or verifiable in this repository.

Every number below is reproducible: reset the dashboard, play both bundled clips at shipped
defaults (`conf 0.30`, `N=2`), and read the Analytics page.

---

## SECTION 1 — TEAM DETAILS

**Team Name**
> DuoQueue

**Project Title**
> Gagan Soochak — On-device civic hazard detection and repair workflow

**In one sentence, what exact problem does your working prototype solve?**
> It detects potholes, waterlogged roads and drain overflows from road video entirely on the
> operator's own device, and turns each detection into a tracked municipal work item —
> evidence, severity, responsible department, and a lifecycle to verified closure.

---

## SECTION 2 — TECHNICAL SUBMISSION

**GitHub Repository URL**
> https://github.com/r44gh4v/Gagan-Soochak

**Final GitHub Commit Hash or Release Tag**
> **[FILL]** — pin at submission time. Latest at time of writing: `b6873f6`

**Final 5-Minute Demonstration Video URL**
> **[FILL]**

**Dashboard/Working Application URL**
> **[FILL]** — Vercel. Imports with no configuration and no environment variables.

---

## SECTION 3 — CURRENT BUILD STATUS

**What is working TODAY? (max 150 words)**

> YOLOv8n runs entirely in the browser via ONNX Runtime Web (WebGPU, threaded-WASM fallback)
> in a Web Worker — the ~12 MB model downloads once, is cached, and works offline afterwards.
> Three-class detection with real confidences, measured ~39–58 ms per inference at ~30 Hz
> sampling. Centroid tracker and severity scoring ported verbatim from our Python edge
> pipeline, with numeric parity proven. Repeat sightings of one physical defect cluster into
> a single work item. Each incident carries full evidence: class, severity with its
> spatial/temporal decomposition, confidence, location, timestamp, annotated frame and crop.
> Auto-routing to BBMP Roads / BBMP Storm Water Drain / BWSSB, a class×severity action
> playbook, and a full lifecycle — assign, start, resolve, verify-close, reject as false
> positive, escalate — every change audit-stamped. Filterable queue with bulk actions,
> JSON/CSV export, analytics, and file upload so judges can run their own footage.

**What is simulated, mocked or manually configured? (max 100 words)**

> GPS is simulated: the patrol advances along a preset Electronic City route at 30 km/h, so
> coordinates are interpolated, not sensed. Timestamps derive from an operator-set patrol
> start plus video timecode. Department, crew and contact names are representative, not live
> municipal integrations. SLA hours are displayed guidance, not enforced timers. Bundled
> footage is pre-recorded, not a live drone feed. Optional seeded incidents are badged "SEED
> DATA". Every simulated field is badged in the UI and exported as
> `location_source=simulated`. Detections, confidences, severity scores, latencies, the
> lifecycle and the audit trail are all real and measured.

**What remains future scope and is NOT implemented? (max 100 words)**

> `damaged_footpath`, the fourth track class, was prepared but is not in the shipped model:
> adding a fourth class to a single all-in-one detector pushed it past the CPU real-time
> budget we committed to, so we shipped three classes that run in real time on-device rather
> than four that do not. We claim no accuracy figure for it. Also future: live drone/RTSP
> ingest; OpenVINO/INT8 CPU export and Jetson+TensorRT edge deployment; a real multi-object
> tracker with re-identification; real GPS/telemetry; a multi-operator server database;
> automated SLA timers and auto-escalation; municipal ticketing integration; and a retraining
> loop fed by operator rejections.

**What can the jury observe today that did not exist in your original proposal? (max 100 words)**

> The entire civic workflow layer, and a browser-native inference path. The proposal had a
> Python script writing rows to SQLite with an OpenCV preview window. The jury can now open a
> URL, watch the model download to their own machine, drop in a video we have never seen, and
> drive a detection through to verified closure with an audit trail — no installation. Also
> new: repeat-sighting clustering so one pothole is one ticket rather than twenty, a measured
> false-alert rate on real footage, and numeric proof that the browser and the Python
> pipeline produce the same model output.

---

## SECTION 4 — TESTING & EVIDENCE

**Best measurable result (include metrics + test data used)**

> **Detection accuracy (validation, 20% held-out split):** mAP50 — pothole **0.893**,
> waterlogged_road **0.743**, drain_overflow **0.720**. All three clear the proposal's 0.70
> target. drain_overflow is measured over only ~16 validation instances, so it carries wide
> error bars — we state that rather than quoting the figure bare.
>
> **False-alert rate (measured on real footage, not validation):** **2 of 10 incidents =
> 20%**, on `Test_1_Pothole.mp4` (8.9 s, 1080×1920 motorcycle dashcam) and `Test_2.mp4`
> (22.1 s, 854×480, drain eruption flooding a street). Both false alerts were `pothole` class
> below 0.36 confidence; drain_overflow and waterlogged_road had zero. Per-incident labelling
> table with every annotated frame: `evidence/false_alert_rate.md`.
>
> **Throughput / latency (browser, WebGPU, production build):** ~39–58 ms per inference,
> ~30 Hz sampling at N=2, 92–166 frames processed per clip. Python CPU baseline for the same
> model: 7.7 FPS unskipped, ~14–15 FPS at N=2.
>
> **Runtime parity:** identical model output between Python `onnxruntime` and browser
> `onnxruntime-web` to 4–5 significant figures on an identical input tensor. On real footage,
> the same frame gives conf 0.8562 (Python `.pt`) vs 0.8361 (browser ONNX), boxes within
> 3 px. See `evidence/parity_check.md`.
>
> **Clustering:** 141 raw detections → 10 incidents (21 repeat sightings merged).

**GitHub link to results/test/evidence folder**
> https://github.com/r44gh4v/Gagan-Soochak/tree/main/evidence

**Describe 3 successful cases and 2 failure/false-positive/false-negative/edge cases.
Mention where evidence is available in GitHub.**

> Full write-up with annotated frames: `evidence/cases.md`. Frames: `evidence/frames/`.
> Raw export: `evidence/incidents_export.csv`.
>
> **Success 1 — `INC-2026-0002`:** pothole at 0.708 confidence, box tight on a real pothole;
> the same frame matches the Python pipeline within 3 px. Routed to BBMP Road Maintenance and
> driven to verified closure. (`evidence/frames/INC-2026-0002.jpg`)
>
> **Success 2 — `INC-2026-0004`:** drain overflow at 0.508, severity 0.625 (High) — the only
> High alert of the run, auto-routed to BWSSB Sewerage Division, a different department from
> the pothole above, from the same pipeline. (`evidence/frames/INC-2026-0004.jpg`)
>
> **Success 3 — `INC-2026-0009`:** one drain defect seen 20× collapsed into a single work
> item; across both clips 141 detections became 10 incidents, each merge audit-stamped.
> (`evidence/frames/INC-2026-0009.jpg`)
>
> **Failure 1 — `INC-2026-0001`:** false positive — a dark road-edge shadow read as a pothole
> at 0.358. Handled by the operator's Reject action, which records a reason in the audit trail
> and the CSV export. (`evidence/frames/INC-2026-0001.jpg`)
>
> **Failure 2 — `INC-2026-0005`:** misclassification — the flooded scene also reported as a
> pothole at 0.301, barely over threshold. The hazard is real but the class is wrong, which
> matters operationally: it would route to BBMP Roads instead of BWSSB.
> (`evidence/frames/INC-2026-0005.jpg`)
>
> **Edge case — `INC-2026-0003`:** a genuine distant pothole scores severity 0.081 (Low)
> because the spatial term is `bbox_area / frame_area`, so it sorts to the bottom of the
> queue. Found, but deprioritised. (`evidence/frames/INC-2026-0003.jpg`)

**Biggest limitation of the current prototype**

> `drain_overflow` is trained on roughly 80 images after filtering, with only ~16 validation
> instances — its 0.720 mAP50 sits close to the target threshold and is the least
> statistically trustworthy number we report. More annotation for that one class would
> improve the system more than any other single change. Operationally, the biggest limitation
> is that the 0.30 confidence threshold is deliberately permissive, so an operator must reject
> roughly one in five incidents as a false alert.

---

## SECTION 5 — DATASET

**What data did you use?** (tick)
> ☑ Public dataset  ☑ Self-recorded footage
> (Not used: ELCIA/ELCITA challenge footage, synthetic/generated data, staged test cases.)

**Dataset names / source links**
> Three Roboflow Universe datasets, merged and class-remapped into one 3-class taxonomy:
> - pothole — `o-v8`
> - waterlogged_road — `kk1` (source class `puddle`, remapped)
> - drain_overflow — `chaitanya-kharche/drain-overflow` (only the "overflowing" classes kept)
>
> Test footage is self-recorded / personally sourced dashcam video, committed as
> `public/videos/Test_1_Pothole.mp4` and `public/videos/Test_2.mp4`.

**Approximate amount of data used**
> ~2,409 raw images before filtering (608 pothole + 1,499 waterlogged + 302 drain overflow);
> drain overflow reduces to ~80 after dropping non-overflowing classes. 80/20 train/val split.
> **[VERIFY]** — recount `dataset/images/train` and `val` on the training machine and publish
> the exact post-merge figure instead of this estimate.

**What data did your team personally annotate/label? (If none, write None.)**
> **[FILL — answer truthfully]** If the team only curated, remapped and filtered existing
> public annotations rather than drawing new boxes, the correct answer is **None**.

---

## SECTION 6 — TEAM OWNERSHIP

**Team Member 1 — name and what they personally implemented**
> **[FILL]** — e.g. dataset sourcing, merge/remap script, both training runs, `pipeline.py`,
> ONNX export and verification.

**Team Member 2 — name and what they personally implemented**
> **[FILL]** — e.g. browser inference worker, detection/severity port, incident workflow,
> dashboard UI, deployment.

**Which part of the system are you most confident demonstrating LIVE?**
> The full detect → evidence → assign → close flow on a video the judges supply themselves.
> We can also disconnect the network mid-demo and keep detecting, which proves inference is
> genuinely on-device.

---

## SECTION 7 — DECLARATION

All five boxes can be ticked honestly:

- **GitHub represents our current working implementation** — yes; the deployed dashboard
  builds from this repository with no configuration.
- **Working, simulated and future features are clearly separated** — yes; the in-app
  `/about` page carries a real-vs-simulated table, every simulated field is badged in the UI,
  and exports mark `location_source=simulated`.
- **Submitted results are actually measured, not estimated or fabricated** — yes; mAP50 from
  the training run, latency and throughput from the Analytics page, false-alert rate from
  per-incident labelling of committed frames. Where a number is uncertain (drain_overflow's
  ~16 validation instances) we say so.
- **We understand judges may ask us to run code, change parameters, show failure cases or
  explain implementation files** — yes; confidence and frame-skip are live sliders, and two
  failure cases are documented with frames.
- **The 5-minute video demonstrates our submitted implementation and includes the team
  member(s) explaining their work** — **[ENSURE WHEN RECORDING]**

---

## Q&A — likely questions, with honest answers

**"Is this actually running locally, or calling an API?"**
Open DevTools → Network. After the one-time model download there are no requests. Go offline
and it still detects. There is no inference endpoint in the codebase — verified: zero
fetch/XHR, zero cross-origin requests during a run.

**"Does our uploaded video get sent anywhere?"**
No. It becomes an in-memory `blob:` URL read frame-by-frame on your machine. Measured: zero
network requests referencing the file, zero cross-origin traffic. There is no upload endpoint.

**"You said you tried ONNX and it didn't help."**
That was `onnxruntime-gpu` installed on a CPU-only laptop — a packaging mistake, not an ONNX
limitation. OpenVINO is the CPU edge path; ONNX Runtime Web is the only browser path. One
trained model, two runtimes, parity-verified.

**"Only three of the four classes?"**
Yes. `damaged_footpath` was prepared, but a fourth class in one all-in-one detector broke the
CPU real-time budget, so we shipped three that run in real time over four that don't. We
claim no accuracy figure for it because none was measured on a shipped model.

**"How often is it wrong?"**
20% of incidents were false alerts on our test footage — 2 of 10, both `pothole` below 0.36
confidence. We labelled every incident against its stored frame; the frames are committed, so
any row can be disputed.

**"Why should I trust the severity number?"**
It is not a model output. `severity = 0.6 × (bbox_area / frame_area) + 0.4 × min(consecutive,
10)/10`, and the evidence card shows the spatial and temporal terms separately for every
incident, so the number is auditable.

**"What happens with five operators?"**
Client-side persistence is a deliberate choice for this evaluation. `Incident` is a plain
serialisable object and the Zustand store is the single swap point for a server API.

**"Why does one clip produce so few incidents?"**
Because repeat sightings of the same physical defect are clustered — 141 raw detections
became 10 work items. A ward engineer should get one ticket per pothole, not twenty.

---

## Demo video beat sheet (5 min)

| Time | Beat |
|---|---|
| 0:00–0:30 | Face on camera. Problem in one sentence, name the track. |
| 0:30–1:15 | Open the live URL cold. Show the model downloading in the Network tab. Reload — cached, instant. "Runs on your device, no server." |
| 1:15–2:30 | Play Test 1. Boxes appear, incidents populate the Queue. Drag the confidence slider up — watch weak detections disappear. |
| 2:30–3:30 | Open one incident. Walk every evidence field. Show the severity decomposition. Assign → start → resolve → verify-close. Show the audit trail. |
| 3:30–4:15 | Reject a false positive and say why — 20% measured false-alert rate, all pothole-class under 0.36. Escalate one. Show filters and the repeat-sighting count. |
| 4:15–4:45 | Analytics: session metrics vs training metrics side by side. Then `/about`: real-vs-simulated table, and say out loud "three of four track classes — damaged footpath is future scope." |
| 4:45–5:00 | **Upload a clip the judges have never seen** and let it detect live. Repo + limitations. |

Ending on judge-supplied footage kills any suspicion of a canned demo.
