#!/usr/bin/env python3
"""לפני ואחרי: וי-דיווידר מונפש (wipe), צד-לצד (side) או מעלה-מטה (stack), עם תגי "לפני"/"אחרי".
שימוש: python3 compare.py BEFORE.mp4 [AFTER.mp4] [--mode wipe|side|stack] [--preset cinematic] [--seconds N] [--out ...]
סרטון אחד בלבד = המקור מול גרסה עם צבעוניות (color-grade). בעברית "לפני" מימין ו"אחרי" משמאל."""
import argparse, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "color-grade"))
import lib


def divider_png(path, h, w=64):
    """קו מוביל לבן עם זוהר כחול ועיגול באמצע."""
    from PIL import Image, ImageDraw, ImageFilter
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    d.rectangle((w // 2 - 3, 0, w // 2 + 3, h), fill=(25, 168, 255, 255))
    d.ellipse((w // 2 - 24, h // 2 - 24, w // 2 + 24, h // 2 + 24), fill=(25, 168, 255, 255))
    g = g.filter(ImageFilter.GaussianBlur(9))
    img = Image.alpha_composite(img, g)
    d = ImageDraw.Draw(img)
    d.rectangle((w // 2 - 2, 0, w // 2 + 1, h), fill=(255, 255, 255, 255))
    d.ellipse((w // 2 - 17, h // 2 - 17, w // 2 + 16, h // 2 + 16), fill=(255, 255, 255, 255))
    d.polygon([(w // 2 - 9, h // 2), (w // 2 - 3, h // 2 - 6), (w // 2 - 3, h // 2 + 6)], fill=(20, 30, 50, 255))
    d.polygon([(w // 2 + 8, h // 2), (w // 2 + 2, h // 2 - 6), (w // 2 + 2, h // 2 + 6)], fill=(20, 30, 50, 255))
    img.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="לפני [אחרי]")
    ap.add_argument("--mode", default="wipe", choices=["wipe", "side", "stack"])
    ap.add_argument("--preset", default="cinematic", help="לסרטון יחיד: איזה לוק (color-grade)")
    ap.add_argument("--seconds", type=float, help="אורך מקסימלי (ברירת מחדל עד 20 שניות)")
    ap.add_argument("--before-label", default="לפני")
    ap.add_argument("--after-label", default="אחרי")
    ap.add_argument("--out")
    a = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="ba_"))
    before = a.inputs[0]
    if len(a.inputs) >= 2:
        after = a.inputs[1]
    else:
        import grade
        after = str(tmp / "graded.mp4")
        grade.grade_clip(before, after, a.preset)
    ib, ia = lib.probe(before), lib.probe(after)
    D = min(ib["duration"], ia["duration"], a.seconds or 20.0)
    fps = 30

    # גודל הבד
    if a.mode == "stack":
        W, H = 1080, 1920
        pw, ph = W, H // 2
    elif a.mode == "side":
        ph = min(1080, ia["height"]) // 2 * 2
        pw = int(ph * ia["width"] / ia["height"]) // 2 * 2
        pw = min(pw, 960)
        W, H = pw * 2 + 8, ph
    else:
        W, H = lib.work_size(ia, 1080)
        pw, ph = W, H

    # תגיות
    ps = max(30, int(min(W, H) * 0.05))
    bw_, bh_ = lib.pill_png(a.before_label, str(tmp / "pb.png"), ps, bg=(8, 12, 22, 190), accent=(255, 255, 255, 110))
    aw_, ah_ = lib.pill_png(a.after_label, str(tmp / "pa.png"), ps, bg=(25, 120, 190, 215), accent=(255, 255, 255, 150))
    m = int(min(W, H) * 0.04)

    ins = ["-t", f"{D:.3f}", "-i", before, "-t", f"{D:.3f}", "-i", after,
           "-loop", "1", "-framerate", str(fps), "-t", f"{D:.3f}", "-i", str(tmp / "pb.png"),
           "-loop", "1", "-framerate", str(fps), "-t", f"{D:.3f}", "-i", str(tmp / "pa.png")]
    fit = lambda w, h: lib.fit_filter(w, h, fps)
    if a.mode == "wipe":
        divider_png(str(tmp / "line.png"), H)
        ins += ["-loop", "1", "-framerate", str(fps), "-t", f"{D:.3f}", "-i", str(tmp / "line.png")]
        # מיקום הקו: החזקה קצרה, מעבר חלק, החזקה בסוף (0 = הכול "לפני", W = הכול "אחרי")
        u = f"min(1,max(0,(t-0.5)/{max(D - 1.4, 0.5):.3f}))"
        p = f"({W}*({u}*{u}*(3-2*{u})))"
        fc = [f"[0:v]{fit(W, H)},format=yuv420p[b]", f"[1:v]{fit(W, H)},format=yuv420p[a]",
              f"color=c=black:s={W}x{H}:r={fps}:d={D:.3f},format=gray[m0]",
              f"color=c=white:s={W}x{H}:r={fps}:d={D:.3f},format=gray[mw]",
              f"[m0][mw]overlay=x='{p}-{W}':y=0:eval=frame,format=gray[mask]",
              "[b][a][mask]maskedmerge[mix]",
              # תגיות מוצגות רק כשיש להן מקום בצד שלהן
              f"[mix][2:v]overlay=x={W - bw_ - m}:y={m}:enable='gt({W}-{p},{bw_ + 2 * m})'[v1]",
              f"[v1][3:v]overlay=x={m}:y={m}:enable='gt({p},{aw_ + 2 * m})'[v2]",
              f"[v2][4:v]overlay=x='{p}-32':y=0:eval=frame:enable='between(t,0.1,{D:.3f})'[vout]"]
    else:
        if a.mode == "stack":
            pos_b, pos_a = (0, 0), (0, ph)
            stackf = "vstack"
        else:
            pos_b, pos_a = (pw + 8, 0), (0, 0)  # לפני מימין, אחרי משמאל
            stackf = None
        fc = [f"[0:v]{fit(pw, ph)}[b]", f"[1:v]{fit(pw, ph)}[a]",
              f"color=c=0x0b1220:s={W}x{H}:r={fps}:d={D:.3f},format=yuv420p[bg]",
              f"[bg][b]overlay={pos_b[0]}:{pos_b[1]}[x1]", f"[x1][a]overlay={pos_a[0]}:{pos_a[1]}[x2]",
              f"[x2][2:v]overlay={pos_b[0] + (pw - bw_ - m if a.mode == 'side' else m)}:{pos_b[1] + m}[x3]",
              f"[x3][3:v]overlay={pos_a[0] + m}:{pos_a[1] + m}[vout]"]
        if a.mode == "side":  # לפני מימין: התג מימין לפאנל
            pass
    dst = lib.out_path(before, a.mode, a.out)
    audio = ["-map", "1:a:0" if ia["has_audio"] else "0:a:0"] if (ia["has_audio"] or ib["has_audio"]) else ["-an"]
    ac = lib.AUDIO_ENC if audio != ["-an"] else []
    lib.ffmpeg(ins + ["-filter_complex", ";".join(fc), "-map", "[vout]"] + audio +
               ["-t", f"{D:.3f}", "-shortest"] + lib.ENC + ac + [dst])
    print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
