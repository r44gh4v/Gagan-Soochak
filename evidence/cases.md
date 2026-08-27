# Test cases - successes and failures

> Submission Form Section 4 asks for 3 successful cases and 2
> failure/false-positive/false-negative/edge cases, with evidence in GitHub.
> All timestamps refer to the bundled clips in `public/videos/` (the team's own
> dashcam test footage). Numbers are measured, reproducible via
> `cd ml && uv run python parity_footage.py <clip> <t>`.

## Success case 1 - high-confidence pothole, runtime parity proven

`test_video.mp4` @ t=0.0s: pothole detected at **0.8562** confidence by the Python
pipeline (`best.pt`) and **0.8361** by the browser-equivalent ONNX path - same box within
3 px (`parity_footage_testvideo_t0.json`). In the dashboard this becomes an incident with
evidence, auto-suggested owner (BBMP Road Maintenance), and the full lifecycle
open → assigned → in_progress → resolved → closed with an audit entry per step.

## Success case 2 - all three classes on one clip

`Test_Video2.mp4` fires all three hazard classes at conf ≥ 0.30: pothole (t≈2-3.5s),
drain_overflow (t≈0.5, 4.5, 6.5, 8.5, 9, 13s), waterlogged_road (t≈7, 21.5s). The
drain_overflow at t=4.5s: `.pt` 0.4922 vs browser-math 0.4963, same box within tens of px
(`parity_footage_video2_t4.5.json`). Each class routes to its own department: pothole →
BBMP Road Maintenance, waterlogged → BBMP Storm Water Drain Cell, drain overflow → BWSSB
Sewerage Division.

## Success case 3 - waterlogged road promoted to P1

The waterlogged_road detections on `Test_Video2.mp4` (t≈7s) demonstrate the class-aware
priority rule: Medium-severity waterlogging is promoted to P1 (standing water is a
two-wheeler safety risk before it is a maintenance item), visible on the incident's
priority chip and exported CSV.

## Failure case 1 - false positive on a synthetic non-road pattern

An 8-second synthetic video (procedural asphalt noise + lane dashes + one dark ellipse -
no real road content) uploaded through the dashboard's file-upload path produced a
`pothole` detection at **0.597** confidence (incident `INC-2026-0001`, severity 0.066 Low).
A dark elliptical blob on road-like texture is exactly the visual signature the class
learned; at the permissive 0.30 threshold it fires. This is what the **Reject (false
positive)** action exists for - the rejection reason lands in the audit trail and CSV.

## Failure case 2 - near-threshold instability between runtimes

`test_video.mp4` @ t=0.0s: the browser-path ONNX (fp32) reports a **second** pothole at
0.4036 that the fp16 `.pt` path scores just below the 0.30 threshold - the same physical
region flips in/out of the detection set depending on numeric precision
(`parity_footage_testvideo_t0.json`, second entry). Consequence: detection counts near the
threshold are not perfectly stable across runtimes; disclosed in `parity_check.md` rather
than hidden. Operationally harmless - the flip happens only on low-confidence candidates,
which land as Low-severity incidents an operator triages anyway.

## Failure case 3 (edge) - small distant potholes deprioritised

The severity formula's spatial term keeps small/distant real potholes at Low
(`test_video.mp4` t=4.5s: pothole at 0.30 conf, small box → severity ≈ 0.05), which
deprioritises them even when genuine - a false-negative-in-effect for prioritisation. The
temporal term partially compensates as the vehicle approaches and the box grows.

## Workflow-level demonstrations (seeded data, badged SEED)

- **Full lifecycle:** driven live in the app: audit trail `DETECTED → ASSIGNED → STARTED →
  RESOLVED → VERIFIED_CLOSED`, `closedAt` stamped, resolution note recorded.
- **Escalation:** seeded `INC-2026-S005`: P2 → P1, owner flagged "(Escalated - Ward
  Engineer)", reason in audit.
- **Rejection:** seeded `INC-2026-S011`/`S012`: rejected with reasons, visible under the
  Rejected filter, no owner (consistent with their open → rejected audit history).
