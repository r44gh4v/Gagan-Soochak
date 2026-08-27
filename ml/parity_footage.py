"""On-footage parity: pipeline.py's exact path (best.pt via Ultralytics) vs
the web build's math (best.onnx + manual two-step preprocess + decode/NMS),
on the same real video frame.

The numeric probe (parity_probe.py) already proved the decode math is
identical across Python and onnxruntime-web; this closes the loop on real
pixels and the full preprocessing chain.

Run:  uv run python parity_footage.py [video] [t_seconds]
"""

import json
import sys

import cv2
import numpy as np
import onnxruntime as ort
from ultralytics import YOLO

VIDEO = sys.argv[1] if len(sys.argv) > 1 else "../public/videos/test_video.mp4"
T = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
CONF = 0.3
IOU = 0.45
RESIZE = (640, 720)  # w, h — pipeline.py L44
SIZE = 640


def grab_frame():
    cap = cv2.VideoCapture(VIDEO)
    cap.set(cv2.CAP_PROP_POS_MSEC, T * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"could not read frame at {T}s from {VIDEO}")
    return frame


def side_pt(frame):
    """pipeline.py L277-295 verbatim."""
    model = YOLO("best.pt")
    model.to("cpu")
    resized = cv2.resize(frame, RESIZE)
    sx = frame.shape[1] / RESIZE[0]
    sy = frame.shape[0] / RESIZE[1]
    result = model.predict(resized, verbose=False)[0]
    out = []
    for box in result.boxes:
        conf = float(box.conf[0])
        if conf < CONF:
            continue
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        out.append({
            "cls": model.names[int(box.cls[0])],
            "conf": round(conf, 4),
            "box": [int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy)],
        })
    return sorted(out, key=lambda d: -d["conf"])


def side_onnx(frame):
    """The web build's exact math: stretch 640x720 -> letterbox 640x640 ->
    onnx -> decode -> un-letterbox -> scale to source px (postprocess.ts)."""
    resized = cv2.resize(frame, RESIZE)  # step 1 (stretch)
    scale = min(SIZE / RESIZE[0], SIZE / RESIZE[1])
    dw, dh = round(RESIZE[0] * scale), round(RESIZE[1] * scale)
    pad_x, pad_y = (SIZE - dw) / 2, (SIZE - dh) / 2
    canvas = np.full((SIZE, SIZE, 3), 114, np.uint8)
    lb = cv2.resize(resized, (dw, dh))  # step 2 (letterbox scale)
    y0, x0 = int(round(pad_y)), int(round(pad_x))
    canvas[y0 : y0 + dh, x0 : x0 + dw] = lb

    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = rgb.transpose(2, 0, 1)[None]

    sess = ort.InferenceSession("best.onnx", providers=["CPUExecutionProvider"])
    y = sess.run(None, {"images": x})[0][0]  # [7, 8400]

    sx, sy = frame.shape[1] / RESIZE[0], frame.shape[0] / RESIZE[1]
    names = ["pothole", "waterlogged_road", "drain_overflow"]
    cands = []
    scores = y[4:7]
    best = scores.max(axis=0)
    best_cls = scores.argmax(axis=0)
    for i in np.flatnonzero(best >= CONF):
        cx, cy, w, h = y[0, i], y[1, i], y[2, i], y[3, i]
        bx1 = (cx - w / 2 - pad_x) / scale * sx
        by1 = (cy - h / 2 - pad_y) / scale * sy
        bx2 = (cx + w / 2 - pad_x) / scale * sx
        by2 = (cy + h / 2 - pad_y) / scale * sy
        cands.append({
            "cls": names[int(best_cls[i])],
            "conf": round(float(best[i]), 4),
            "box": [int(bx1), int(by1), int(bx2), int(by2)],
        })

    # greedy per-class NMS (postprocess.ts)
    def iou(a, b):
        ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
        ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        if not inter:
            return 0.0
        ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
        return inter / ua

    kept = []
    for c in names:
        cl = sorted([d for d in cands if d["cls"] == c], key=lambda d: -d["conf"])
        while cl:
            top = cl.pop(0)
            kept.append(top)
            cl = [d for d in cl if iou(top["box"], d["box"]) <= IOU]
    return sorted(kept, key=lambda d: -d["conf"])


frame = grab_frame()
result = {
    "video": VIDEO,
    "t_seconds": T,
    "frame_shape": list(frame.shape),
    "pt_ultralytics": side_pt(frame),
    "onnx_webmath": side_onnx(frame),
}
print(json.dumps(result, indent=2))
with open("parity_footage.json", "w") as f:
    json.dump(result, f, indent=2)
