"""Export best.pt (YOLOv8n, 3 classes) to ONNX for in-browser inference.

Produces best.onnx alongside this script:
  input  "images"  [1, 3, 640, 640] float32, RGB, 0-1, NCHW
  output "output0" [1, 7, 8400]     float32
         rows 0-3 = cx, cy, w, h (in 640-px letterboxed space)
         rows 4-6 = class scores (pothole, waterlogged_road, drain_overflow)

nms=False on purpose: ONNX Runtime Web's support for the fused NMS subgraph
is unreliable across backends, so NMS is done in TypeScript on the web side.
This is also what enables the dashboard's live confidence slider.

Run:  uv run python export_onnx.py
"""

from ultralytics import YOLO

model = YOLO("best.pt")
path = model.export(
    format="onnx",
    opset=12,
    imgsz=640,
    simplify=True,
    dynamic=False,
    nms=False,
    half=False,  # fp32 - ORT-web fp16 support is uneven
)
print(f"exported: {path}")
