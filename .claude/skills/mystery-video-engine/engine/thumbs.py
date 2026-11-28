# תמונות ממוזערות מהסרטון:
#   contact_sheets – דפים עם תמונה כל כמה שניות + הזמן, בשביל ה"עיניים" של Claude (כניסה, ישיבה בעמדה, יציאה).
#   timeline_sprite – פס תמונות לטיימליין במערכת (המשתמש מסמן קטעי חובה) + אינדקס JSON.
import json, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont


def _frames(src, every, width, tmp):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"fps=1/{every},scale={width}:-2",
                    "-q:v", "4", os.path.join(tmp, "f%05d.jpg")], check=True)
    return sorted(os.path.join(tmp, f) for f in os.listdir(tmp) if f.startswith("f"))


def contact_sheets(src, out_dir, every=6, cols=10, rows=8, width=192):
    """דפי תמונות עם חותמת זמן (שניות במקור). מחזיר רשימת קבצי JPG."""
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        files = _frames(src, every, width, tmp)
        if not files:
            return []
        w, h = Image.open(files[0]).size
        font = ImageFont.load_default()
        sheets, per = [], cols * rows
        for s in range(0, len(files), per):
            sheet = Image.new("RGB", (cols * w, rows * h), "black")
            d = ImageDraw.Draw(sheet)
            for i, f in enumerate(files[s:s + per]):
                x, y = (i % cols) * w, (i // cols) * h
                sheet.paste(Image.open(f), (x, y))
                t = (s + i) * every + every / 2  # fps=1/N לוקח את אמצע כל חלון
                d.rectangle([x, y, x + 52, y + 14], fill="black")
                d.text((x + 3, y + 1), f"{t:.0f}s", fill="yellow", font=font)
            p = os.path.join(out_dir, f"sheet{len(sheets):02d}.jpg")
            sheet.save(p, quality=80)
            sheets.append(p)
    return sheets


def timeline_sprite(src, out_dir, every=2, width=160):
    """פס תמונות לטיימליין: sprite.jpg + sprite.json ({every, width, height, count})."""
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        files = _frames(src, every, width, tmp)
        w, h = Image.open(files[0]).size
        sprite = Image.new("RGB", (w * len(files), h))
        for i, f in enumerate(files):
            sprite.paste(Image.open(f), (i * w, 0))
        sprite.save(os.path.join(out_dir, "sprite.jpg"), quality=70)
    meta = {"every": every, "width": w, "height": h, "count": len(files)}
    json.dump(meta, open(os.path.join(out_dir, "sprite.json"), "w"))
    return meta
