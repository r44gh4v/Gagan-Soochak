"""Numeric parity probe: Python vs TypeScript decode path.

Feeds a deterministic synthetic 640x640 tensor (identical bytes to the JS
probe, same LCG) through best.onnx and dumps raw output stats + decoded boxes
using the same math pipeline.py relies on. scripts/parity-probe.mjs does the
identical thing via onnxruntime-web; compare the two JSON files.

This isolates the real parity risks — tensor layout, channel order, decode
strides, NMS — from image-resampling differences (cv2 vs canvas), which are
bounded separately by the on-footage check.

Run:  uv run python parity_probe.py   ->  parity_python.json
"""

import json

import numpy as np
import onnxruntime as ort

SIZE = 640
CONF = 0.25
IOU = 0.45


def lcg_image() -> np.ndarray:
    """Deterministic RGB float tensor via a 32-bit LCG (same as JS probe)."""
    n = 3 * SIZE * SIZE
    out = np.empty(n, dtype=np.float32)
    state = 123456789
    for i in range(n):
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        out[i] = (state % 256) / 255.0
    return out.reshape(1, 3, SIZE, SIZE)


def decode(output: np.ndarray):
    """Same decode as src/lib/model/postprocess.ts (identity meta: no letterbox)."""
    out = output[0]  # [7, 8400]
    boxes, scores, classes = [], [], []
    cls_scores = out[4:7]
    best = cls_scores.max(axis=0)
    best_cls = cls_scores.argmax(axis=0)
    keep = best >= CONF
    for i in np.flatnonzero(keep):
        cx, cy, w, h = out[0, i], out[1, i], out[2, i], out[3, i]
        boxes.append([float(cx - w / 2), float(cy - h / 2), float(cx + w / 2), float(cy + h / 2)])
        scores.append(float(best[i]))
        classes.append(int(best_cls[i]))

    # greedy per-class NMS
    kept = []
    for c in set(classes):
        idxs = [i for i in range(len(boxes)) if classes[i] == c]
        idxs.sort(key=lambda i: -scores[i])
        while idxs:
            i = idxs.pop(0)
            kept.append(i)
            idxs = [j for j in idxs if iou(boxes[i], boxes[j]) <= IOU]
    kept.sort(key=lambda i: -scores[i])
    return [
        {
            "cls": classes[i],
            "conf": round(scores[i], 5),
            "box": [round(v, 2) for v in boxes[i]],
        }
        for i in kept
    ]


def iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua


def main():
    sess = ort.InferenceSession("best.onnx", providers=["CPUExecutionProvider"])
    x = lcg_image()
    y = sess.run(None, {"images": x})[0]

    result = {
        "inputChecksum": round(float(x.sum()), 2),
        "outputShape": list(y.shape),
        "outputStats": {
            "sum": round(float(y.sum()), 1),
            "boxMean": round(float(y[0, :4].mean()), 4),
            "scoreMax": round(float(y[0, 4:7].max()), 5),
            "scoreMean": round(float(y[0, 4:7].mean()), 6),
        },
        "detections": decode(y),
    }
    with open("parity_python.json", "w") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
