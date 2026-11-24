"""הורדה אוטומטית של סרטון לאפליקציית GTA 6 (gta6-fetch.yml).

השרת (gta6/api) שולח אות עם מזהה; כאן שואלים את השרת מה הקישור, מורידים את הסרטון עם yt-dlp
ומעלים אותו בחזרה לשרת (/video/upload), שמעביר אותו ל-Gemini לצפייה.
המאגר ציבורי: בלוג לא מודפס הקישור ולא שום תוכן של המשתמש – רק "הצליח" / "נכשל".
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

API = os.environ["GTA6_API"].rstrip("/")
TOKEN = os.environ["GTA6_TOKEN"]
MAX_BYTES = 90 * 1024 * 1024


def call(path, data=None, method="GET", headers=None, body=None):
    h = {"authorization": f"Bearer {TOKEN}", "user-agent": "gta6-fetch"}
    h.update(headers or {})
    if data is not None:
        body = json.dumps(data).encode()
        h["content-type"] = "application/json"
    req = urllib.request.Request(f"{API}{path}", data=body, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=300) as res:
        return json.loads(res.read() or b"{}")


def failed(item_id, reason):
    try:
        call("/video/fetch-failed", {"id": item_id, "reason": reason}, method="POST")
    except Exception:  # noqa: BLE001 – השרת יסמן "צריך להעלות" אחרי זמן קצוב בכל מקרה
        pass
    print(f"download failed ({reason})")
    sys.exit(0)


def main(item_id):
    try:
        url = call(f"/video/job?id={item_id}")["url"]
    except Exception:  # noqa: BLE001
        print("no open job")
        return
    out_dir = tempfile.mkdtemp()
    out = os.path.join(out_dir, "video.%(ext)s")
    cmd = [
        "yt-dlp", "--quiet", "--no-warnings", "--no-progress", "--no-playlist",
        "--max-filesize", "90M",
        "-f", "best[ext=mp4][height<=720]/best[height<=720]/best[ext=mp4]/best",
        "-o", out, url,
    ]
    # הפלט של yt-dlp לא מודפס (יכול לכלול את הקישור)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=False)
    files = [f for f in os.listdir(out_dir) if not f.endswith(".part")]
    if result.returncode != 0 or not files:
        failed(item_id, "too_big" if "max-filesize" in (result.stderr + result.stdout).lower() else "blocked")
    path = os.path.join(out_dir, files[0])
    size = os.path.getsize(path)
    if size > MAX_BYTES:
        failed(item_id, "too_big")
    mime = "video/webm" if path.endswith(".webm") else "video/mp4"
    with open(path, "rb") as f:
        req = urllib.request.Request(
            f"{API}/video/upload?id={item_id}", data=f, method="POST",
            headers={"content-type": mime, "content-length": str(size), "user-agent": "gta6-fetch"},
        )
        try:
            with urllib.request.urlopen(req, timeout=600) as res:
                res.read()
        except Exception:  # noqa: BLE001
            failed(item_id, "blocked")
    print(f"uploaded ({size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
