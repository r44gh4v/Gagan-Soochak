# Test cases — 3 successes, 2 failures

> Submission Form Section 4. Every case below is from a single reset-and-run of the two
> bundled clips at shipped defaults (`conf 0.30`, `N=2`). Annotated evidence frame for each
> incident is committed in `evidence/frames/`; the full export is
> `evidence/incidents_export.csv`. Labelling method and the full 10-row table:
> `evidence/false_alert_rate.md`.

## Success 1 — high-confidence pothole, runtime parity proven

**`INC-2026-0002`** · `Test_1_Pothole.mp4` @ 4.3 s · pothole · **conf 0.708** · severity
0.335 (Medium) · seen 8× · `evidence/frames/INC-2026-0002.jpg`

Box sits tightly on a clear pothole in the carriageway. The same frame through the Python
pipeline gives 0.8562 vs 0.8361 on the browser path, box within 3 px
(`evidence/parity_footage_testvideo_t0.json`) — the dashboard is running the same model
maths as the edge pipeline, not an approximation.

In the dashboard this became a work item routed to **BBMP Road Maintenance**, drivable
through assign → start → resolve → verified close with an audit entry per step.

## Success 2 — drain overflow detected and correctly routed

**`INC-2026-0004`** · `Test_2.mp4` @ 0.6 s · drain_overflow · conf 0.508 · **severity 0.625
(High)** · seen 8× · `evidence/frames/INC-2026-0004.jpg`

Water erupting from a drain across a residential street. Highest-severity incident of the
run and the only one to fire the one-time **High alert**. Auto-routed to **BWSSB Sewerage
Division** — a different department from the pothole above, from the same detection
pipeline. Recommended action: emergency desilting within 4 h, cordon the footpath, raise a
sewage-mix public-health check.

## Success 3 — repeat sightings collapsed into one work item

**`INC-2026-0009`** · `Test_2.mp4` · drain_overflow · **seen 20×** ·
`evidence/frames/INC-2026-0009.jpg`

Across both clips, **141 raw detections became 10 incidents** (21 sightings merged). The
tracker drops a hazard when it leaves frame and re-acquires it moments later; without
clustering this one defect alone would have opened 20 tickets. Each merge is written to the
incident's audit trail as `REPEAT_SIGHTING`, and the record upgrades to the most severe
sighting rather than keeping the first.

## Failure 1 — false positive: road-edge shadow read as a pothole

**`INC-2026-0001`** · `Test_1_Pothole.mp4` @ 0.6 s · pothole · **conf 0.358** · severity
0.324 (Medium) · `evidence/frames/INC-2026-0001.jpg`

The box sits on a dark irregular patch at the road edge — shadow and worn tarmac, not a
pothole. `pothole` is the class most prone to this: it learned "dark irregular patch on
road texture". At a deliberately permissive 0.30 threshold this is the expected cost, and
the operator's **Reject (false positive)** action is the designed compensation — the
rejection reason lands in the audit trail and the CSV export.

## Failure 2 — misclassification: flooding read as a pothole

**`INC-2026-0005`** · `Test_2.mp4` @ 2.0 s · pothole · **conf 0.301** · severity 0.597
(Medium) · `evidence/frames/INC-2026-0005.jpg`

The same flooded scene that `drain_overflow` and `waterlogged_road` both correctly
identified is *also* reported as a pothole at 0.301 — barely over the threshold. Turbulent
brown water presents as a dark irregular patch. The hazard is real but the class is wrong,
which matters operationally: a pothole ticket routes to BBMP Roads instead of BWSSB.

Both failures share a signature — **`pothole` class, confidence below 0.36**. Per class on
this footage: pothole 2 FP / 4 (50%), drain_overflow 0 / 3, waterlogged_road 0 / 3.
Confidence alone does not separate them: raising the cutoff to 0.36 removes both errors but
also drops three true positives (0.312, 0.325, 0.334), so the threshold was left at the
shipped 0.30 rather than tuned to flatter the numbers.

## Edge case — small distant defects are deprioritised, not missed

**`INC-2026-0003`** · pothole · conf 0.389 · **severity 0.081 (Low)** ·
`evidence/frames/INC-2026-0003.jpg`

Correctly detected on visibly broken road surface, but the severity formula's spatial term
(`bbox_area / frame_area`) keeps distant defects Low, so it sorts to the bottom of the
queue. It is found, just not prioritised — the temporal term compensates as the vehicle
approaches and the box grows.

## Workflow cases (seeded data, badged SEED)

- **Full lifecycle** — `DETECTED → ASSIGNED → STARTED → RESOLVED → VERIFIED_CLOSED`, with
  `closedAt` stamped and the resolution note recorded.
- **Escalation** — `INC-2026-S005`: P2 → P1, owner flagged "(Escalated — Ward Engineer)".
- **Rejection** — `INC-2026-S011` / `S012`: rejected with reasons, visible under the
  Rejected filter, no owner (consistent with their open → rejected history).
