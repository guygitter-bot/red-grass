# גרפיקה לסרטון ביקורת: כרטיסי שימור/שיפור, שקופית פתיחה, מסך סיכום (PNG, 1280x720)
# עברית נכונה (RTL) דרך text_png של video-tools – לא drawtext של ffmpeg.
import json, os, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from text_he import text_png
from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parents[1] / "assets"
W, H = 1280, 720
NAVY, BLUE = (10, 20, 70), (20, 40, 160)       # כחול סמסונג
SBLUE, LIGHT, DARK = (18, 89, 214), (66, 150, 245), (20, 24, 40)
KEEP, FIX = (0, 200, 140), (255, 168, 0)        # ירוק = שימור, כתום = שיפור


def _put(img, text, x, y, anchor="right", **kw):
    """מצייר טקסט; anchor: right = x הוא הקצה הימני, center = x הוא המרכז."""
    fd, p = tempfile.mkstemp(suffix=".png"); os.close(fd)
    w, h = text_png(text, p, pad=0, **kw)
    left = x - w if anchor == "right" else x - w / 2
    img.alpha_composite(Image.open(p), (int(left), int(y)))
    os.remove(p)
    return w, h


def _icon(d, cx, cy, r, kind):
    acc = KEEP if kind == "keep" else FIX
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=acc + (255,))
    lw = max(3, int(r / 4.2))
    if kind == "keep":
        d.line([(cx - r * .47, cy + r * .05), (cx - r * .12, cy + r * .41), (cx + r * .53, cy - r * .41)], fill=NAVY + (255,), width=lw, joint="curve")
    else:
        d.line([(cx, cy + r * .47), (cx, cy - r * .41)], fill=NAVY + (255,), width=lw)
        d.line([(cx - r * .41, cy), (cx, cy - r * .47), (cx + r * .41, cy)], fill=NAVY + (255,), width=lw, joint="curve")


def card(kind, text, out, scale=0.74):
    """כרטיס שימור (keep) / שיפור (fix). scale 0.74 = הגודל הקטן שנבחר לקבוצות."""
    S, Wc = 2, 440
    label = "שימור" if kind == "keep" else "לשיפור"
    acc = KEEP if kind == "keep" else FIX
    tmp = tempfile.mkdtemp()
    tw, th = text_png(text, f"{tmp}/t.png", size=26 * S, weight=600, pad=0, max_width=(Wc - 110) * S, align="right")
    lw, lh = text_png(label, f"{tmp}/l.png", size=15 * S, weight=700, color=acc + (255,), pad=0)
    h, w, sh = max(64 * S, th + lh + 34 * S), Wc * S, 14 * S
    img = Image.new("RGBA", (w + 2 * sh, h + 2 * sh), (0, 0, 0, 0))
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([sh, sh + 4 * S, sh + w, sh + h + 4 * S], 18 * S, fill=(0, 0, 20, 140))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(8 * S)))
    body = Image.new("RGBA", (w, h))
    bd = ImageDraw.Draw(body)
    for x in range(w):
        f = x / w
        bd.line([(x, 0), (x, h)], fill=tuple(int(NAVY[i] * (1 - f) + BLUE[i] * f) for i in range(3)) + (225,))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 18 * S, fill=255)
    img.paste(body, (sh, sh), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([sh + w - 7 * S, sh + 12 * S, sh + w - 2 * S, sh + h - 12 * S], 3 * S, fill=acc + (255,))
    _icon(d, sh + w - 42 * S, sh + h // 2, 17 * S, kind)
    right, top = sh + w - 72 * S, sh + (h - (lh + 6 * S + th)) // 2
    img.alpha_composite(Image.open(f"{tmp}/l.png"), (right - lw, top))
    img.alpha_composite(Image.open(f"{tmp}/t.png"), (right - tw, top + lh + 6 * S))
    f = scale / S
    img.resize((int(img.width * f), int(img.height * f)), Image.LANCZOS).save(out)
    return out


def _rr_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m


def intro(lines, photo, out, logo_top=str(ASSETS / "sunny.png"), logo_bottom=str(ASSETS / "zoomact.png")):
    """שקופית פתיחה לבנה ומודרנית: לוגו למעלה, לוגו למטה, תמונה במסגרת מעוגלת מימין.
    lines = [כותרת, שורה 2, שורה 3, תאריך] – המלל בדיוק כמו בשקופית של הלקוח. שורה ריקה = מדלגים."""
    S = 2
    img = Image.new("RGBA", (W * S, H * S), (255, 255, 255, 255))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-300 * S, 380 * S, 520 * S, 1100 * S], fill=LIGHT + (40,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120 * S)))
    px0, py0, px1, py1 = 720, 44, 1236, 676
    acc = Image.new("RGBA", ((px1 - px0) * S, (py1 - py0) * S))
    ad = ImageDraw.Draw(acc)
    for y in range(acc.height):
        f = y / acc.height
        ad.line([(0, y), (acc.width, y)], fill=tuple(int(LIGHT[i] * (1 - f) + SBLUE[i] * f) for i in range(3)) + (255,))
    img.paste(acc, ((px0 - 26) * S, (py0 + 22) * S), _rr_mask(acc.size, 44 * S))
    ph = Image.open(photo).convert("RGB")
    pw, phh = (px1 - px0) * S, (py1 - py0) * S
    sc = max(pw / ph.width, phh / ph.height)
    ph = ph.resize((int(ph.width * sc), int(ph.height * sc)), Image.LANCZOS)
    ph = ph.crop(((ph.width - pw) // 2, (ph.height - phh) // 2, (ph.width - pw) // 2 + pw, (ph.height - phh) // 2 + phh)).convert("RGBA")
    tint = Image.new("RGBA", ph.size)
    td = ImageDraw.Draw(tint)
    for x in range(pw):
        td.line([(x, 0), (x, phh)], fill=SBLUE + (int(110 * (1 - x / pw) ** 2),))
    img.paste(Image.alpha_composite(ph, tint), (px0 * S, py0 * S), _rr_mask((pw, phh), 40 * S))
    d = ImageDraw.Draw(img)
    d.ellipse([(px0 - 70) * S, 120 * S, (px0 - 30) * S, 160 * S], fill=LIGHT + (255,))
    d.ellipse([(px0 - 46) * S, 70 * S, (px0 - 10) * S, 106 * S], outline=SBLUE + (255,), width=5 * S)
    # לוגואים (PNG שקוף): למעלה משמאל ולמטה משמאל, מוקטנים לתוך מסגרת קבועה
    for path, box, top in ((logo_top, (320, 160), 30), (logo_bottom, (300, 110), 600)):
        if path:
            lg = Image.open(path).convert("RGBA")
            sc = min(box[0] * S / lg.width, box[1] * S / lg.height)
            lg = lg.resize((max(1, int(lg.width * sc)), max(1, int(lg.height * sc))), Image.LANCZOS)
            img.alpha_composite(lg, (50 * S, top * S))
    title, l2, l3, date = (list(lines) + ["", "", "", ""])[:4]
    CX = 380 * S
    _put(img, title, CX, 222 * S, "center", size=70 * S, weight=800, color=SBLUE + (255,))
    d.rounded_rectangle([CX - 40 * S, 318 * S, CX + 40 * S, 324 * S], 3 * S, fill=LIGHT + (255,))
    y = 350
    for t in (l2, l3):
        if t:
            _put(img, t, CX, y * S, "center", size=46 * S, weight=600, color=DARK + (255,))
            y += 60
    if date:
        _put(img, date, CX, (y + 20) * S, "center", size=30 * S, weight=500, color=SBLUE + (255,))
    img.resize((W, H), Image.LANCZOS).convert("RGB").save(out)
    return out


def outro(keep, fix, score, bg_frame, out):
    """מסך סיכום: שתי עמודות שימור / לשיפור על רקע מטושטש מהחנות בכחול סמסונג."""
    img = Image.open(bg_frame).convert("RGB").resize((W, H)).filter(ImageFilter.GaussianBlur(18)).convert("RGBA")
    ov = Image.new("RGBA", (W, H))
    od = ImageDraw.Draw(ov)
    for x in range(W):
        k = x / W
        od.line([(x, 0), (x, H)], fill=tuple(int(NAVY[i] * (1 - k) + BLUE[i] * k) for i in range(3)) + (215,))
    img = Image.alpha_composite(img, ov)
    _put(img, "סיכום הביקור", W - 80, 50, size=54, weight=800)
    if score:
        _put(img, f"ציון {score}", 280, 62, size=34, weight=700, color=(150, 190, 255, 255))
    for right, title, kind, items in [(W - 80, "שימור", "keep", keep), (W // 2 - 20, "לשיפור", "fix", fix)]:
        left = right - 560
        p = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(p).rounded_rectangle([left, 140, right, 660], 24, fill=(255, 255, 255, 22), outline=(255, 255, 255, 50), width=2)
        img.alpha_composite(p)
        d = ImageDraw.Draw(img)
        accent = KEEP if kind == "keep" else FIX
        _icon(d, right - 44, 186, 20, kind)
        _put(img, title, right - 76, 166, size=34, weight=800, color=accent + (255,))
        y = 240
        for it in items:
            d.ellipse([right - 50, y + 14, right - 38, y + 26], fill=accent + (255,))
            _, h = _put(img, it, right - 66, y, size=25, weight=500, max_width=470, align="right")
            y += h + 22
    img.convert("RGB").save(out)
    return out


def frame(src, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", f"scale={W}:{H}", out], check=True)
    return out


if __name__ == "__main__":
    # python3 graphics.py intro  out.png photo.jpg "כותרת" "שורה 2" "שורה 3" "תאריך"
    # python3 graphics.py outro  out.png bg.jpg summary.json      ({"keep":[...], "fix":[...], "score":"77.42"})
    # python3 graphics.py frame  out.jpg SRC.mp4 SECONDS
    # python3 graphics.py card   out.png keep|fix "טקסט"
    cmd, out = sys.argv[1], sys.argv[2]
    if cmd == "intro":
        intro(sys.argv[4:8], sys.argv[3], out)
    elif cmd == "outro":
        s = json.load(open(sys.argv[4]))
        outro(s["keep"], s["fix"], s.get("score"), sys.argv[3], out)
    elif cmd == "frame":
        frame(sys.argv[3], float(sys.argv[4]), out)
    elif cmd == "card":
        card(sys.argv[3], sys.argv[4], out)
    print(f"OUTPUT: {out}")
