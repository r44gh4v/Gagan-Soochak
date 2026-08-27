import {
  CONF_THRESHOLD,
  DETECTION_WINDOW,
  HAZARD_EXPIRE_GAP,
  MATCH_DISTANCE_THRESHOLD,
  PROCESS_EVERY_N,
} from "@/lib/detection/constants";

export const metadata = {
  title: "Methodology — Gagan Soochak",
};

/**
 * The honesty page: model card, formulas, what's real vs mocked, limitations.
 * Written to directly answer Submission Form Section 3 and judge Q&A.
 */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 py-4 leading-relaxed">
      <section>
        <h1 className="text-xl font-semibold">How Gagan Soochak works</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Gagan Soochak (&ldquo;sky informer&rdquo;) detects monsoon road hazards —
          potholes, waterlogged roads, drain overflow — from drone/dashcam video and
          drives each detection through a civic repair workflow: evidence capture,
          department routing, escalation, and verified closure. Detection runs{" "}
          <strong>entirely in your browser</strong>: the trained model downloads once
          (~12 MB), is cached, and processes frames on your device. No video and no
          detection ever touches a server.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Model card</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {(
                [
                  ["Architecture", "YOLOv8n (nano), 3 classes, trained 100 epochs on Colab T4"],
                  ["Weights", "best.pt 6.26 MB fp16 → best.onnx 11.7 MB fp32, opset 12, nms=False"],
                  ["Runtime", "ONNX Runtime Web — WebGPU when available, threaded WASM fallback, in a Web Worker"],
                  ["Classes", "pothole · waterlogged_road · drain_overflow"],
                  ["Validation mAP50", "pothole 0.893 · waterlogged_road 0.743 · drain_overflow 0.720 (all clear the 0.70 target)"],
                  ["Data", "3 Roboflow Universe datasets remapped to a unified taxonomy, 80/20 split. drain_overflow: ~80 images post-filter, ~16 validation instances — wide error bars."],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="w-40 py-2 pr-4 align-top text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {k}
                  </td>
                  <td className="py-2 text-sm">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong>Why nano over small:</strong> YOLOv8s scored marginally higher
          (avg +0.02 mAP) but ran ~3.5 FPS on a laptop CPU against a 10 FPS
          real-time commitment. Nano runs 7.7 FPS unskipped, ~14–15 FPS at N=2 —
          an accuracy-for-latency trade with measured numbers on both sides.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Coverage — 3 of 4 track classes</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The track brief names four detection targets. <strong>damaged_footpath is
          not implemented</strong> — not sourced, not annotated, not trained. The
          merge pipeline already supports adding it (new source + class map +
          retrain), and it leads our future-scope list. We&apos;d rather you hear
          that from us than count the filter options.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Severity scoring</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Ported verbatim from the Python edge pipeline:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs">
          {`severity = 0.6 × (bbox_area / frame_area)  +  0.4 × min(consecutive, ${DETECTION_WINDOW}) / ${DETECTION_WINDOW}

≥ 0.60 → High      ≥ 0.30 → Medium      else → Low`}
        </pre>
        <p className="mt-2 text-sm text-muted-foreground">
          A hazard filling ~5% of frame starts Low (0.07) and needs persistence to
          escalate; one filling ~50% of frame is Medium immediately (0.34) and High
          (0.70) after {DETECTION_WINDOW} consecutive sightings. The evidence card
          shows the decomposition for every incident, so &ldquo;High&rdquo; is an
          auditable number, not a model&apos;s opinion.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Tracking &amp; frame skipping</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Same-class nearest-centroid matching within{" "}
          {MATCH_DISTANCE_THRESHOLD * 100}% of the frame diagonal; hazards expire
          after {HAZARD_EXPIRE_GAP} unmatched processed frames. IoU matching was
          tried first and failed on moving-camera footage — boxes shift between
          frames even when the hazard is static. No Kalman filter, no
          re-identification: two very close same-class hazards can be confused.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Inference runs on every {PROCESS_EVERY_N}nd frame (~12–15 Hz effective at
          25–30 FPS source), with detections ≥ {CONF_THRESHOLD} confidence kept. A
          hazard would need to cross the entire frame in under ~0.08 s to be missed —
          a disclosed engineering tradeoff, not a shortcut. Boxes persist on skipped
          frames; their position updates only on processed ones (cosmetic lag only).
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Preprocessing parity</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The Python pipeline stretches frames to 640×720 (aspect distorted), then
          Ultralytics letterboxes to 640×640 internally. This build replicates{" "}
          <strong>both steps</strong> rather than letterboxing the source directly —
          the model must see the same pixels in both runtimes for detections to
          match. One genuine divergence: Python gets NMS from Ultralytics
          internally; here NMS runs in TypeScript (IoU 0.45) because the ONNX export
          strips it — which is also what makes the live confidence slider possible.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">What&apos;s real / what&apos;s simulated</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold text-emerald-700">Real &amp; measured</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Detections, classes, confidences</li>
              <li>Severity scores and their decomposition</li>
              <li>Inference latency, FPS, frame counts</li>
              <li>Tracker persistence (sightings)</li>
              <li>Full incident lifecycle + audit trail</li>
              <li>Validation mAP50 (held-out set)</li>
            </ul>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-semibold text-amber-700">Simulated / configured</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>GPS — interpolated along preset Electronic City patrol routes (badged SIMULATED)</li>
              <li>Timestamps — patrol start + video timecode (badged DERIVED)</li>
              <li>Departments, crews, contacts — representative, not live systems</li>
              <li>SLA hours — displayed guidance, not enforced timers</li>
              <li>Footage — pre-recorded clips, not a live drone feed</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold">Known limitations</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          <li>
            damaged_footpath (4th track class) not implemented — future scope.
          </li>
          <li>
            drain_overflow is the weak class: ~80 training images, mAP50 0.720 over
            ~16 validation instances. More annotation here beats any other single
            improvement.
          </li>
          <li>
            Centroid tracking confuses adjacent same-class hazards; repeat passes
            over the same street create separate incidents (no de-duplication).
          </li>
          <li>Single video stream; no live RTSP/drone ingest in this build.</li>
          <li>
            Incident store is per-browser (localStorage + IndexedDB) by design for
            this evaluation — a server DB is a contained swap at the store boundary.
          </li>
          <li>Not yet tested on official ELCIA-provided footage.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold">Deployment paths</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          One trained model, two runtimes: <strong>ONNX Runtime Web</strong> in the
          operator&apos;s browser (this dashboard — zero install, works offline
          after first load) and the <strong>Python pipeline</strong> for edge boxes,
          where OpenVINO/INT8 export and Jetson+TensorRT are the next steps. An
          earlier ONNX attempt on the Python side used a GPU-oriented runtime
          package on a CPU-only machine — a packaging mistake, not an ONNX
          limitation, and unrelated to the browser path used here.
        </p>
      </section>
    </article>
  );
}
