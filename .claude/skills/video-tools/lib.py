#!/usr/bin/env python3
"""עזרים משותפים לסקילים של עריכת וידאו: ffprobe, ffmpeg, טקסט עברי ל-PNG, שמות קבצי פלט."""
import json, os, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONT = HERE / "fonts" / "Rubik.ttf"
FFMPEG = "ffmpeg"
# הגדרות קידוד אחידות
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
       "-movflags", "+faststart"]
AUDIO_ENC = ["-c:a", "aac", "-b:a", "160k", "-ar", "44100"]
FORMATS = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080), "4:5": (1080, 1350)}


def run(cmd, quiet=True):
    """מריץ פקודה; בכישלון מדפיס את סוף הלוג ויוצא."""
    cmd = [str(c) for c in cmd]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write("הפקודה נכשלה:\n" + " ".join(cmd[:12]) + " ...\n" + r.stderr[-2500:] + "\n")
        sys.exit(1)
    return r


def ffmpeg(args, quiet=True):
    """מריץ ffmpeg עם -y ו-loglevel שקט."""
    return run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-nostdin"] + list(args))


def probe(path):
    """מידע על קובץ: רוחב/גובה (אחרי סיבוב), משך, fps, יש אודיו."""
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path])
    j = json.loads(r.stdout)
    info = {"width": 0, "height": 0, "duration": 0.0, "fps": 30.0, "has_audio": False, "has_video": False}
    for s in j.get("streams", []):
        if s["codec_type"] == "video" and not info["has_video"]:
            info["has_video"] = True
            w, h = int(s.get("width", 0)), int(s.get("height", 0))
            rot = 0
            for sd in s.get("side_data_list", []) or []:
                if "rotation" in sd:
                    rot = int(sd["rotation"])
            if rot in (90, -90, 270, -270):
                w, h = h, w
            info["width"], info["height"] = w, h
            try:
                a, b = s.get("avg_frame_rate", "30/1").split("/")
                fps = float(a) / float(b) if float(b) else 30.0
                info["fps"] = fps if 1 < fps < 121 else 30.0
            except Exception:
                pass
            if s.get("duration"):
                info["duration"] = float(s["duration"])
        if s["codec_type"] == "audio":
            info["has_audio"] = True
    fd = j.get("format", {}).get("duration")
    if fd and (not info["duration"] or info["has_video"] is False):
        info["duration"] = float(fd)
    if not info["duration"] and fd:
        info["duration"] = float(fd)
    return info


def is_image(path):
    return Path(path).suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def out_path(src, suffix, out=None, ext=".mp4"):
    """שם קובץ פלט. out יכול להיות קובץ מלא או תיקייה; ברירת מחדל: $VIDEO_OUT_DIR או /tmp/video-out."""
    if out:
        p = Path(out)
        if p.suffix:
            p.parent.mkdir(parents=True, exist_ok=True)
            return str(p)
        p.mkdir(parents=True, exist_ok=True)
        d = p
    else:
        d = Path(os.environ.get("VIDEO_OUT_DIR", "/tmp/video-out"))
        d.mkdir(parents=True, exist_ok=True)
    return str(d / f"{Path(src).stem}_{suffix}{ext}")


def fit_filter(w, h, fps=None):
    """סינון ffmpeg שממלא מסגרת w*h (חיתוך מרכזי, בלי עיוות)."""
    f = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1"
    if fps:
        f += f",fps={fps}"
    return f


def work_size(info, maxdim=1080):
    """גודל עבודה זוגי, מוגבל ל-maxdim בצד הארוך."""
    w, h = info["width"], info["height"]
    sc = min(1.0, maxdim / max(w, h))
    return int(w * sc) // 2 * 2, int(h * sc) // 2 * 2


def _font(size, weight=700):
    from PIL import ImageFont
    f = ImageFont.truetype(str(FONT), size, layout_engine=ImageFont.Layout.RAQM)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def is_rtl(text):
    return any("֐" <= c <= "׿" for c in text)


def text_png(text, out, size=80, weight=700, color=(255, 255, 255, 255), pad=20,
             glow=None, stroke=0, stroke_color=(0, 0, 0, 255), max_width=None, align="center"):
    """מצייר טקסט (עברית RTL נכונה) ל-PNG שקוף; מחזיר (רוחב, גובה). max_width: שבירת שורות אוטומטית."""
    from PIL import Image, ImageDraw, ImageFilter
    rtl = is_rtl(text)
    d = "rtl" if rtl else "ltr"
    font = _font(size, weight)
    meas = ImageDraw.Draw(Image.new("RGBA", (4, 4)))

    def width(s):
        return meas.textlength(s, font=font, direction=d, features=None)

    lines = []
    for para in text.split("\n"):
        if max_width and width(para) > max_width:
            cur = ""
            for wd in para.split(" "):
                t = (cur + " " + wd).strip()
                if width(t) <= max_width or not cur:
                    cur = t
                else:
                    lines.append(cur)
                    cur = wd
            lines.append(cur)
        else:
            lines.append(para)
    lh = int(size * 1.25)
    gl = int(glow[0]) if glow else 0
    mw = int(max(width(l) for l in lines))
    W = mw + 2 * (pad + gl + stroke)
    H = lh * len(lines) + 2 * (pad + gl) // 1
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)

    def draw_all(draw, fill, sw=0, sc=None):
        y = pad + gl
        for l in lines:
            lw = width(l)
            if align == "center":
                x = (W - lw) / 2
            else:
                x = W - pad - gl - stroke - lw if rtl else pad + gl + stroke
            draw.text((x, y), l, font=font, fill=fill, direction=d, stroke_width=sw, stroke_fill=sc)
            y += lh

    if glow:
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_all(ImageDraw.Draw(g), glow[1])
        g = g.filter(ImageFilter.GaussianBlur(glow[0] / 2.2))
        img = Image.alpha_composite(img, g)
        dr = ImageDraw.Draw(img)
    draw_all(dr, color, stroke, stroke_color)
    img.save(out)
    return W, H


def pill_png(text, out, size=56, bg=(0, 0, 0, 170), color=(255, 255, 255, 255), accent=None, weight=700):
    """תג מעוגל (pill) עם טקסט; מחזיר (רוחב, גובה)."""
    from PIL import Image, ImageDraw
    font = _font(size, weight)
    d = "rtl" if is_rtl(text) else "ltr"
    meas = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    tw = int(meas.textlength(text, font=font, direction=d))
    px, py = int(size * 0.7), int(size * 0.32)
    W, H = tw + 2 * px, int(size * 1.25) + 2 * py - int(size * 0.25)
    sc = 3  # הגדלה לשיפור החלקת קצוות
    big = Image.new("RGBA", (W * sc, H * sc), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    bd.rounded_rectangle((0, 0, W * sc - 1, H * sc - 1), radius=H * sc // 2, fill=bg,
                         outline=accent, width=3 * sc if accent else 0)
    img = big.resize((W, H), Image.LANCZOS)
    dr = ImageDraw.Draw(img)
    dr.text((W / 2, H / 2 + size * 0.04), text, font=font, fill=color, direction=d, anchor="mm")
    img.save(out)
    return W, H


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tmpdir(prefix="vt"):
    import tempfile
    return tempfile.mkdtemp(prefix=prefix + "_")
