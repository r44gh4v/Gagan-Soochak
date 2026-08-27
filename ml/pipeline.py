"""
DuoQueue — Detection + Severity Scoring + Event Logging Pipeline

Video source -> YOLOv8n inference -> track hazards across frames ->
severity score -> log to SQLite -> save alert thumbnails.

This is the piece that turns "a trained model" into "a working system" —
run it against a video file now; later, swap VIDEO_SOURCE for an RTSP
URL or webcam index and nothing else about the pipeline changes.

Usage:
    python pipeline.py
"""

import os
import sqlite3
import time
from datetime import datetime

import cv2
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Config — edit these for your setup
# ---------------------------------------------------------------------------

MODEL_PATH = "best.pt"

# Any of these work identically with cv2.VideoCapture:
#   "test_video.mp4"                    <- a file
#   0                                   <- default webcam
#   "rtsp://192.168.1.50:554/live"      <- a live CCTV/IP-cam stream
VIDEO_SOURCE = "test_video.mp4"

# Zone tag for this camera — proposal's "camera-to-location mapping",
# manual static lookup for now. Change per camera if you run more than one.
ZONE_NAME = "Electronics City - Hosur Road"

# Speed: process every Nth frame. With yolov8n: 7.7 FPS unskipped, ~14-15 FPS
# at N=2 on a laptop CPU (see Technical Build Notes §4). The old N=4 default
# dated from the yolov8s run. See severity-persistence note below for why
# skipping doesn't hurt detection quality for this use case.
PROCESS_EVERY_N = 2
RESIZE_DIM = (640, 720)  # (width, height) — matches proposal's drone-feed spec

# Only trust detections above this confidence — filters model noise
CONF_THRESHOLD = 0.3

# How many *processed* frames a hazard must persist across to count as
# "fully persistent" in the severity formula's temporal term (not raw
# video frames, since we're only processing every Nth one).
DETECTION_WINDOW = 10

# Two detections (of the same class) across consecutive processed frames
# are treated as "the same physical hazard" if their centers are within
# this fraction of the frame's diagonal of each other. Distance-based
# rather than box-overlap-based, since box overlap breaks down fast on a
# moving camera (drone or dashcam) — the same physical pothole shifts
# position between processed frames even though it hasn't moved at all.
MATCH_DISTANCE_THRESHOLD = 0.15

# If a tracked hazard isn't matched for this many processed frames in a
# row, treat it as gone (camera moved on, hazard was fixed, etc.)
HAZARD_EXPIRE_GAP = 5

# Severity thresholds, straight from the proposal
SEVERITY_LEVELS = [
    (0.6, "High"),
    (0.3, "Medium"),
    (0.0, "Low"),
]

# If True, play back at roughly the source video's real frame rate instead
# of as fast as the CPU can go — makes a demo video feel "live" on screen.
# Irrelevant for a genuinely live camera/RTSP source (already real-time).
PACE_TO_REALTIME = True

DB_PATH = "incidents.db"
THUMBNAIL_DIR = "alert_thumbnails"
SHOW_WINDOW = True  # live annotated preview window; press ESC to quit


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            zone TEXT NOT NULL,
            hazard_class TEXT NOT NULL,
            severity_score REAL NOT NULL,
            severity_level TEXT NOT NULL,
            confidence REAL NOT NULL,
            bbox_x1 INTEGER, bbox_y1 INTEGER, bbox_x2 INTEGER, bbox_y2 INTEGER,
            thumbnail_path TEXT,
            status TEXT NOT NULL DEFAULT 'open'
        )
    """)
    conn.commit()
    return conn


def insert_incident(conn, zone, hazard_class, severity_score, severity_level,
                     confidence, bbox, thumbnail_path=None):
    """Called once, the first time a hazard is tracked — logs it immediately
    at whatever severity it starts at (Low/Medium/High), not just High ones.
    Returns the new row's id so later frames can update it in place."""
    cur = conn.execute(
        """INSERT INTO incidents
           (timestamp, zone, hazard_class, severity_score, severity_level,
            confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, thumbnail_path, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')""",
        (
            datetime.now().isoformat(timespec="seconds"),
            zone, hazard_class, severity_score, severity_level, confidence,
            bbox[0], bbox[1], bbox[2], bbox[3], thumbnail_path,
        ),
    )
    conn.commit()
    return cur.lastrowid


def update_incident(conn, row_id, severity_score, severity_level,
                     confidence, bbox, thumbnail_path=None):
    """Called on later frames as the same tracked hazard persists — keeps
    its existing row current instead of inserting a duplicate every frame."""
    if thumbnail_path is not None:
        conn.execute(
            """UPDATE incidents SET severity_score=?, severity_level=?,
               confidence=?, bbox_x1=?, bbox_y1=?, bbox_x2=?, bbox_y2=?,
               thumbnail_path=? WHERE id=?""",
            (severity_score, severity_level, confidence,
             bbox[0], bbox[1], bbox[2], bbox[3], thumbnail_path, row_id),
        )
    else:
        conn.execute(
            """UPDATE incidents SET severity_score=?, severity_level=?,
               confidence=?, bbox_x1=?, bbox_y1=?, bbox_x2=?, bbox_y2=?
               WHERE id=?""",
            (severity_score, severity_level, confidence,
             bbox[0], bbox[1], bbox[2], bbox[3], row_id),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Severity scoring
# ---------------------------------------------------------------------------

def centroid(box):
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def normalized_distance(box_a, box_b, frame_shape):
    """0.0 = same center point, 1.0 = opposite corners of the frame."""
    ax, ay = centroid(box_a)
    bx, by = centroid(box_b)
    diagonal = (frame_shape[0] ** 2 + frame_shape[1] ** 2) ** 0.5
    dist = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5
    return dist / diagonal


def severity_level_for(score: float) -> str:
    for threshold, label in SEVERITY_LEVELS:
        if score >= threshold:
            return label
    return "Low"


def compute_severity(bbox, frame_shape, consecutive_count: int) -> float:
    x1, y1, x2, y2 = bbox
    bbox_area = (x2 - x1) * (y2 - y1)
    frame_area = frame_shape[0] * frame_shape[1]

    spatial_term = bbox_area / frame_area
    temporal_term = min(consecutive_count, DETECTION_WINDOW) / DETECTION_WINDOW

    return 0.6 * spatial_term + 0.4 * temporal_term


# ---------------------------------------------------------------------------
# Simple frame-to-frame hazard tracker
#
# Not a real multi-object tracker (no Kalman filter, no re-ID) — nearest-
# centroid matching against the previous processed frame's boxes. IoU
# matching was tried first and failed on moving-camera footage (the same
# hazard's box shifts between frames even though it hasn't moved).
# ---------------------------------------------------------------------------

class HazardTracker:
    """Not a real multi-object tracker (no Kalman filter, no re-ID) — just
    nearest-centroid matching against the previous processed frame's boxes,
    tolerant of camera motion. Good enough for this use case; would need
    upgrading (optical flow / a real tracker) for very fast, erratic motion."""

    def __init__(self):
        self.active = []  # list of dicts: class, bbox, consecutive_count, last_seen_idx, alerted

    def update(self, detections, processed_idx, frame_shape):
        """detections: list of (class_name, bbox, confidence). Returns list of
        (class_name, bbox, confidence, consecutive_count, hazard_dict, is_new)
        for this frame — is_new tells the caller whether to INSERT or UPDATE
        this hazard's database row."""
        matched_active_ids = set()
        results = []

        for cls_name, bbox, conf in detections:
            best_match, best_dist = None, MATCH_DISTANCE_THRESHOLD
            for i, hazard in enumerate(self.active):
                if i in matched_active_ids or hazard["class"] != cls_name:
                    continue
                dist = normalized_distance(hazard["bbox"], bbox, frame_shape)
                if dist < best_dist:
                    best_match, best_dist = i, dist

            if best_match is not None:
                hazard = self.active[best_match]
                hazard["bbox"] = bbox
                hazard["consecutive_count"] += 1
                hazard["last_seen_idx"] = processed_idx
                matched_active_ids.add(best_match)
                results.append((cls_name, bbox, conf, hazard["consecutive_count"], hazard, False))
            else:
                new_hazard = {
                    "class": cls_name, "bbox": bbox, "consecutive_count": 1,
                    "last_seen_idx": processed_idx, "alerted": False,
                    "db_id": None, "last_logged_level": None,
                }
                self.active.append(new_hazard)
                results.append((cls_name, bbox, conf, 1, new_hazard, True))

        # Drop hazards not seen recently
        self.active = [
            h for h in self.active
            if processed_idx - h["last_seen_idx"] <= HAZARD_EXPIRE_GAP
        ]

        return results


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    conn = init_db(DB_PATH)

    model = YOLO(MODEL_PATH)
    model.to("cpu")

    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        print(f"[error] could not open video source: {VIDEO_SOURCE}")
        return

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_delay = (1.0 / source_fps) if PACE_TO_REALTIME else 0.0

    tracker = HazardTracker()
    frame_idx = 0
    processed_idx = 0

    print(f"Running on {VIDEO_SOURCE} | zone: {ZONE_NAME} | "
          f"processing every {PROCESS_EVERY_N} frames")

    while True:
        loop_start = time.time()
        ok, frame = cap.read()
        if not ok:
            break

        if frame_idx % PROCESS_EVERY_N == 0:
            resized = cv2.resize(frame, RESIZE_DIM)
            scale_x = frame.shape[1] / RESIZE_DIM[0]
            scale_y = frame.shape[0] / RESIZE_DIM[1]

            result = model.predict(resized, verbose=False)[0]

            detections = []
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < CONF_THRESHOLD:
                    continue
                cls_name = model.names[int(box.cls[0])]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                # scale boxes back to the original frame size for display/logging
                bbox = (
                    int(x1 * scale_x), int(y1 * scale_y),
                    int(x2 * scale_x), int(y2 * scale_y),
                )
                detections.append((cls_name, bbox, conf))

            tracked = tracker.update(detections, processed_idx, frame.shape)

            for cls_name, bbox, conf, consecutive_count, hazard, is_new in tracked:
                score = compute_severity(bbox, frame.shape, consecutive_count)
                level = severity_level_for(score)

                hazard["score"] = score
                hazard["level"] = level

                if is_new:
                    # Log every hazard the moment it's first seen, at
                    # whatever severity it starts at — not just High ones.
                    # This is what feeds the dashboard's full incident log.
                    hazard["db_id"] = insert_incident(
                        conn, ZONE_NAME, cls_name, score, level, conf, bbox)
                    hazard["last_logged_level"] = level
                    print(f"[LOG] {cls_name} | severity={score:.2f} ({level})")
                elif level != hazard["last_logged_level"]:
                    # Same hazard, but its severity level changed since we
                    # last logged it (e.g. Low -> Medium as it persists) —
                    # keep its row current instead of leaving it stale.
                    update_incident(conn, hazard["db_id"], score, level, conf, bbox)
                    hazard["last_logged_level"] = level
                    print(f"[UPDATE] {cls_name} | severity={score:.2f} ({level})")

                # On top of logging, fire an alert (thumbnail + console
                # flag) once per hazard, the first time it crosses High.
                if level == "High" and not hazard["alerted"]:
                    hazard["alerted"] = True
                    thumb_name = f"{cls_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    thumb_path = os.path.join(THUMBNAIL_DIR, thumb_name)
                    cv2.imwrite(thumb_path, frame)
                    update_incident(conn, hazard["db_id"], score, level, conf, bbox, thumb_path)
                    print(f"[ALERT] {cls_name} | severity={score:.2f} ({level}) "
                          f"| zone={ZONE_NAME}")

            processed_idx += 1

        if SHOW_WINDOW:
            # Draw every currently-active hazard's last-known box on EVERY
            # frame, not just the frame it was actually detected on.
            # Otherwise, with PROCESS_EVERY_N > 1, boxes only appear on 1
            # out of every N frames and vanish immediately after — at video
            # speed that's invisible, even though detection is working fine.
            for hazard in tracker.active:
                x1, y1, x2, y2 = hazard["bbox"]
                level = hazard.get("level", "Low")
                score = hazard.get("score", 0.0)
                color = (0, 0, 255) if level == "High" else (
                    (0, 165, 255) if level == "Medium" else (0, 200, 0))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame, f"{hazard['class']} {score:.2f} ({level})",
                    (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, color, 2,
                )
            cv2.imshow("DuoQueue - Monsoon Hazard Detection", frame)
            if cv2.waitKey(1) & 0xFF == 27:  # ESC to quit
                break

        if PACE_TO_REALTIME:
            elapsed = time.time() - loop_start
            if elapsed < frame_delay:
                time.sleep(frame_delay - elapsed)

        frame_idx += 1

    cap.release()
    if SHOW_WINDOW:
        cv2.destroyAllWindows()
    conn.close()
    print(f"Done. Events logged to {DB_PATH}, alert thumbnails in {THUMBNAIL_DIR}/")


if __name__ == "__main__":
    main()