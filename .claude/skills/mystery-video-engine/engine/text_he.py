# ציור טקסט עברי (RTL נכון) ל-PNG שקוף. מועתק מ-video-tools כדי שהמנוע יעמוד לבד.
# דורש Pillow עם raqm (libraqm) – בלי זה העברית יוצאת הפוכה. drawtext של ffmpeg הופך עברית – לא להשתמש בו.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

FONT = Path(__file__).resolve().parent / "fonts" / "Rubik.ttf"


def check_raqm():
    if not features.check("raqm"):
        raise RuntimeError("Pillow is missing libraqm – Hebrew would render reversed. Install libraqm (apt: libraqm0).")


def _font(size, weight=700):
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
    """מצייר טקסט ל-PNG שקוף; מחזיר (רוחב, גובה). max_width = שבירת שורות אוטומטית."""
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
    H = lh * len(lines) + 2 * (pad + gl)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

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
        img = Image.alpha_composite(img, g.filter(ImageFilter.GaussianBlur(glow[0] / 2.2)))
    draw_all(ImageDraw.Draw(img), color, stroke, stroke_color)
    img.save(out)
    return W, H
