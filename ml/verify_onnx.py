"""Verify best.onnx matches the I/O contract the web code depends on.

Run:  uv run python verify_onnx.py
Exits non-zero on any contract violation.
"""

import sys

import numpy as np
import onnxruntime as ort

EXPECT_INPUT = [1, 3, 640, 640]
EXPECT_OUTPUT = [1, 7, 8400]  # 4 box coords + 3 class scores, 8400 anchors

sess = ort.InferenceSession("best.onnx", providers=["CPUExecutionProvider"])
inp, out = sess.get_inputs()[0], sess.get_outputs()[0]

print(f"input : {inp.name} {inp.shape} {inp.type}")
print(f"output: {out.name} {out.shape} {out.type}")

ok = True
if list(inp.shape) != EXPECT_INPUT:
    print(f"FAIL: input shape {inp.shape}, expected {EXPECT_INPUT}")
    ok = False
if list(out.shape) != EXPECT_OUTPUT:
    print(f"FAIL: output shape {out.shape}, expected {EXPECT_OUTPUT}")
    ok = False
if inp.type != "tensor(float)" or out.type != "tensor(float)":
    print("FAIL: expected float32 tensors")
    ok = False

y = sess.run(None, {inp.name: np.zeros(EXPECT_INPUT, np.float32)})[0]
print(f"run   : zeros -> {y.shape}, scores finite: {bool(np.isfinite(y).all())}")
if list(y.shape) != EXPECT_OUTPUT or not np.isfinite(y).all():
    ok = False

# Class scores must already be sigmoid'd (0-1) — web postprocess must NOT re-activate
smin, smax = float(y[0, 4:7].min()), float(y[0, 4:7].max())
print(f"score range on zeros input: [{smin:.4f}, {smax:.4f}]")
if smin < 0.0 or smax > 1.0:
    print("FAIL: class scores outside [0,1] — are they raw logits?")
    ok = False

print("OK" if ok else "CONTRACT VIOLATED")
sys.exit(0 if ok else 1)
