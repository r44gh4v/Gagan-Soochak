import cv2
from ultralytics import YOLO
COL = {"pothole": (0,200,0), "waterlogged_road": (0,165,255), "drain_overflow": (0,0,255)}
def draw(model_path, clip, t, out):
    m = YOLO(model_path); m.to("cpu")
    cap = cv2.VideoCapture(clip); cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
    ok, fr = cap.read(); cap.release()
    rs = cv2.resize(fr, (640,720))
    sx, sy = fr.shape[1]/640, fr.shape[0]/720
    r = m.predict(rs, verbose=False)[0]
    n = 0
    for b in r.boxes:
        c = float(b.conf[0])
        if c < 0.30: continue
        n += 1
        x1,y1,x2,y2 = [int(v) for v in b.xyxy[0].tolist()]
        x1,x2 = int(x1*sx), int(x2*sx); y1,y2 = int(y1*sy), int(y2*sy)
        nm = m.names[int(b.cls[0])]
        col = COL.get(nm,(255,255,255))
        cv2.rectangle(fr,(x1,y1),(x2,y2),col,3)
        cv2.putText(fr,f"{nm} {c:.2f}",(x1,max(24,y1-8)),cv2.FONT_HERSHEY_SIMPLEX,0.7,col,2)
    h = 720; fr = cv2.resize(fr,(int(fr.shape[1]*h/fr.shape[0]), h))
    cv2.imwrite(out, fr)
    print(out, "boxes:", n)

draw("best.pt",   "../public/videos/Test_2.mp4", 4.5, "cmp_best_t2.jpg")
draw("better.pt", "../public/videos/Test_2.mp4", 4.5, "cmp_better_t2.jpg")
draw("best.pt",   "../public/videos/Test_1_Pothole.mp4", 4.3, "cmp_best_t1.jpg")
draw("better.pt", "../public/videos/Test_1_Pothole.mp4", 4.3, "cmp_better_t1.jpg")
