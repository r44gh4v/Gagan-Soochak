# False-alert rate - measured

Submission Form Section 4 asks for a false-alert rate. mAP50 is a validation-set metric and
says nothing about how often the deployed system cries wolf on real road video, so this was
measured directly.

## Method

1. Reset the dashboard (no seeded data, empty store).
2. Play both bundled clips end to end at the shipped defaults (`conf 0.30`, `N=2`).
3. Export the incident CSV from the app (`evidence/incidents_export.csv`).
4. Open each incident's annotated evidence frame and label it **TP** (a real hazard of the
   reported class is inside the box) or **FP** (no such hazard there).

Labelling is per **incident** - the operator-facing work item - not per raw detection,
because an operator triages incidents. 141 raw detections clustered into 10 incidents.

## Result

**2 of 10 incidents were false alerts → 20% false-alert rate.**

| Incident | Class | Conf | Severity | Verdict | Note |
|---|---|---|---|---|---|
| INC-2026-0001 | pothole | 0.358 | 0.324 Medium | **FP** | box on a dark road-edge shadow, no pothole |
| INC-2026-0002 | pothole | 0.708 | 0.335 Medium | TP | tight box on a clear pothole |
| INC-2026-0003 | pothole | 0.389 | 0.081 Low | TP | small distant box on visibly broken road surface |
| INC-2026-0004 | drain_overflow | 0.508 | 0.625 High | TP | water erupting from a drain |
| INC-2026-0005 | pothole | 0.301 | 0.597 Medium | **FP** | the flooded scene misread as a pothole |
| INC-2026-0006 | waterlogged_road | 0.430 | 0.424 Medium | TP | road surface under water |
| INC-2026-0007 | drain_overflow | 0.312 | 0.320 Medium | TP | same eruption, wider box |
| INC-2026-0008 | waterlogged_road | 0.392 | 0.369 Medium | TP | flooded carriageway |
| INC-2026-0009 | drain_overflow | 0.325 | 0.479 Medium | TP | eruption core |
| INC-2026-0010 | waterlogged_road | 0.334 | 0.258 Low | TP | flood spread across the road |

Test data: `public/videos/Test_1_Pothole.mp4` (8.9 s, 1080×1920 motorcycle dashcam,
highway) and `public/videos/Test_2.mp4` (22.1 s, 854×480, drain eruption flooding a
residential street). Frames for every row are reproducible by re-running the clips.

## What the errors have in common

**Both false alerts were the `pothole` class, and both sat at the bottom of the confidence
range (0.301 and 0.358).** Per class on this footage:

| Class | Incidents | FP | FP rate |
|---|---|---|---|
| pothole | 4 | 2 | 50% |
| drain_overflow | 3 | 0 | 0% |
| waterlogged_road | 3 | 0 | 0% |

`pothole` fires on dark irregular patches - a road-edge shadow, and turbulent brown water -
because that is the texture it learned. This is the trade the 0.30 threshold buys: it is
deliberately permissive so real hazards are not missed, and the operator's **Reject (false
positive)** action is the designed compensation.

**Confidence alone does not separate the errors.** Raising the threshold to 0.36 would
remove both false alerts but also drop three true positives (0.312, 0.325, 0.334). We did
not tune the threshold to flatter the number.

## Honest caveats

- 10 incidents is a small sample; the rate has wide error bars. It is a measurement on two
  clips, not a validated benchmark.
- `Test_2` is a single physical event, so its 7 incidents are not 7 independent samples.
  Note that the same flooding produced both `drain_overflow` and `waterlogged_road`
  incidents - both were counted TP, since an overflowing drain does waterlog the road.
  Clustering only merges within a class, so a multi-class event stays multi-incident.
- Labelling was done by inspecting the stored evidence frames. The frames are committed, so
  the judgement is auditable and can be disputed row by row.
