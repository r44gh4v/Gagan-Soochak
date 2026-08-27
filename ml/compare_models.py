"""Head-to-head: best.pt (yolov8n, 3-class) vs better.pt (yolov8s, 2-class).

Samples both bundled clips every 0.5 s, runs each model with the shipped
pipeline preprocessing (cv2.resize to 640x720, conf 0.30) and reports what
each one actually finds, plus per-frame latency.
"""
import time, json
import cv2
from ultralytics import YOLO

CLIPS = ["../public/videos/Test_1_Pothole.mp4", "../public/videos/Test_2.mp4"]
CONF, RESIZE, STEP = 0.30, (640, 720), 0.5

def run(path):
    m = YOLO(path); m.to("cpu")
    out = {"names": m.names, "per_clip": {}, "lat_ms": []}
    for clip in CLIPS:
        cap = cv2.VideoCapture(clip)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        dur = (cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) / fps
        hits, frames, t = {}, 0, 0.0
        while t < dur:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, fr = cap.read()
            if not ok: break
            frames += 1
            t0 = time.perf_counter()
            r = m.predict(cv2.resize(fr, RESIZE), verbose=False)[0]
            out["lat_ms"].append((time.perf_counter() - t0) * 1000)
            for b in r.boxes:
                c = float(b.conf[0])
                if c < CONF: continue
                n = m.names[int(b.cls[0])]
                hits.setdefault(n, []).append(round(c, 3))
            t += STEP
        cap.release()
        out["per_clip"][clip.split("/")[-1]] = {
            "frames_sampled": frames,
            "detections": {k: {"n": len(v), "mean_conf": round(sum(v)/len(v), 3),
                               "max_conf": max(v)} for k, v in sorted(hits.items())},
            "total": sum(len(v) for v in hits.values()),
        }
    lat = sorted(out["lat_ms"])
    out["latency"] = {"mean_ms": round(sum(lat)/len(lat), 1),
                      "p95_ms": round(lat[int(len(lat)*0.95)], 1)}
    del out["lat_ms"]
    return out

res = {f: run(f) for f in ["best.pt", "better.pt"]}
print(json.dumps(res, indent=2))
json.dump(res, open("model_comparison.json", "w"), indent=2)
