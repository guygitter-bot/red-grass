#!/usr/bin/env python3
"""מראה לוח לבן / שרטוט ביד: סרטון או תמונה -> רישום קווים שחורים על נייר, עם "ציור" הדרגתי בהתחלה וכותרת עברית שנכתבת.
שימוש: python3 sketch.py INPUT [--title "כותרת"] [--reveal 2.0] [--detail 1.0] [--seconds N] [--out ...]"""
import argparse, math, sys, tempfile
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
import lib

PAPER = "f7f3e8"   # צבע הנייר
INK = (22, 32, 60)
RED = (230, 57, 70)


def reveal_mask_file(path, W, H, reveal, fps=30):
    """סרטון מסכה גולמי (גווני אפור, רזולוציה נמוכה): חושף את הרישום מלמעלה למטה עם מרקם שרבוט.
    מחזיר (רוחב, גובה, מספר פריימים)."""
    mw, mh = 216, max(2, int(216 * H / W))
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:mh, 0:mw].astype(np.float32)
    ramp = yy / mh * 0.72 + (xx / mw) * 0.10            # סדר הציור: מלמעלה למטה, מעט משמאל לימין
    hatch = 0.5 + 0.5 * np.sin((xx * 0.9 + yy * 0.9) / 2.2)  # פסי שרבוט באלכסון
    rnd = rng.random((mh, mw)).astype(np.float32)
    g = ramp + 0.12 * hatch + 0.08 * rnd
    g = g / g.max()
    n = int(reveal * fps)
    with open(path, "wb") as f:
        for i in range(n + 1):
            u = i / n
            u = u * u * (3 - 2 * u)
            level = u * 1.25 - 0.02
            m = np.clip((level - g) * 6.0, 0, 1)
            f.write((m * 255).astype(np.uint8).tobytes())
    return mw, mh, n + 1


def title_anim_file(path, text, W, H, fps=30, dur=1.4):
    """אנימציית כתיבה לכותרת: RGBA גולמי; הטקסט נחשף מימין לשמאל (כיוון הכתיבה בעברית) ואז קו תחתון."""
    from PIL import Image, ImageDraw
    tmp = path + ".png"
    tw, th = lib.text_png(text, tmp, size=int(W * 0.105), weight=900, color=INK + (255,), pad=24,
                          stroke=7, stroke_color=(255, 255, 255, 255), max_width=int(W * 0.86))
    img = Image.open(tmp).convert("RGBA")
    # קו תחתון מסומן ביד
    d = ImageDraw.Draw(img)
    y0 = th - 14
    pts = [(int(tw * 0.08) + i * 8, y0 + int(5 * math.sin(i / 3.0))) for i in range(int(tw * 0.84 / 8))]
    d.line(pts, fill=RED + (255,), width=10, joint="curve")
    arr = np.array(img)
    a0 = arr[:, :, 3].astype(np.float32)
    n = int(dur * fps)
    ys, xs = np.mgrid[0:th, 0:tw].astype(np.float32)
    # פס חשיפה משופע; הקו התחתון נחשף בסוף
    key = (1 - xs / tw) * 0.8 + (ys / th) * 0.08
    key = np.where(ys > th - 40, 0.8 + (1 - xs / tw) * 0.2, key)
    with open(path, "wb") as f:
        for i in range(n + 1):
            u = i / n
            u = 1 - (1 - u) ** 2
            lvl = u * 1.12
            m = np.clip((lvl - key) * 9.0, 0, 1)
            fr = arr.copy()
            fr[:, :, 3] = (a0 * m).astype(np.uint8)
            f.write(fr.tobytes())
    return tw, th, n + 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--title")
    ap.add_argument("--reveal", type=float, default=2.0, help="משך ה'ציור' ההדרגתי בשניות")
    ap.add_argument("--detail", type=float, default=1.0, help="פרטים: <1 קווים עבים, >1 דקים")
    ap.add_argument("--seconds", type=float, help="לתמונה: אורך הסרטון (ברירת מחדל 6)")
    ap.add_argument("--out")
    a = ap.parse_args()

    img = lib.is_image(a.input)
    info = lib.probe(a.input)
    W, H = lib.work_size(info, 1080)
    fps = 30 if img else min(30, round(info["fps"]))
    D = (a.seconds or 6.0) if img else min(info["duration"], a.seconds or 1e9)
    tmp = Path(tempfile.mkdtemp(prefix="hd_"))
    mw, mh, mn = reveal_mask_file(str(tmp / "mask.raw"), W, H, a.reveal, fps)

    sig = max(3.0, W / 85.0 / a.detail)
    ins = (["-loop", "1", "-framerate", str(fps), "-t", f"{D:.3f}"] if img else ["-t", f"{D:.3f}"]) + ["-i", a.input]
    ins += ["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{mw}x{mh}", "-framerate", str(fps), "-i", str(tmp / "mask.raw")]
    fc = [
        # רישום: אפור חלקי עצמו מטושטש (כמו color dodge) = קווי מתאר בעיפרון
        f"[0:v]scale={W}:{H},fps={fps},format=gray16le,eq=gamma=1.5,split[g1][g2]",
        f"[g2]gblur=sigma={sig:.1f}[bl]",
        "[g1][bl]blend=all_mode=divide,format=gray,"
        "curves=all='0/0 0.55/0.22 0.8/0.7 0.92/1 1/1',format=gbrp[sk]",
        # נייר: מכפילים ברישום צבע נייר חם עם מעט גרגר
        f"color=c=0x{PAPER}:s={W}x{H}:r={fps},noise=alls=4:allf=t,format=gbrp[paper]",
        "[sk][paper]blend=all_mode=multiply,format=yuv420p[drawn]",
        f"color=c=0x{PAPER}:s={W}x{H}:r={fps},format=yuv420p[blank]",
        f"[1:v]scale={W}:{H}:flags=bicubic,format=gray[mk]",
        "[blank][drawn][mk]maskedmerge,format=yuv420p[v0]",
    ]
    last = "v0"
    if a.title:
        tw, th, tn = title_anim_file(str(tmp / "title.raw"), a.title, W, H, fps)
        ins += ["-f", "rawvideo", "-pix_fmt", "rgba", "-video_size", f"{tw}x{th}", "-framerate", str(fps),
                "-i", str(tmp / "title.raw")]
        t0 = min(a.reveal * 0.55, 1.2)
        # הכותרת מתחילה להיכתב באמצע ה"ציור"; הפריים האחרון נשאר על המסך
        fc.append(f"[2:v]setpts=PTS+{t0:.2f}/TB,format=rgba[tt]")
        fc.append(f"[v0][tt]overlay=x=(W-w)/2:y={int(H * 0.07)}:eof_action=repeat:format=auto[v1]")
        last = "v1"
    dst = lib.out_path(a.input, "sketch", a.out)
    audio = ["-map", "0:a:0"] + lib.AUDIO_ENC if (not img and info["has_audio"]) else ["-an"]
    lib.ffmpeg(ins + ["-filter_complex", ";".join(fc), "-map", f"[{last}]"] + audio +
               ["-t", f"{D:.3f}", "-shortest"] + lib.ENC + [dst])
    print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
