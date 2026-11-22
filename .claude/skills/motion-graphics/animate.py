#!/usr/bin/env python3
"""אנימציית HTML חופשית -> סרטון MP4 (פריים אחרי פריים, 30fps).
שימוש: python3 animate.py page.html [--format 9:16|16:9|1:1] [--seconds 10] [--music song.mp3] [--out out.mp4]
הדף: קובץ HTML אחד, גוף בגודל המדויק של הפורמט, ציר זמן שאפשר להזיז (אנימציות CSS / WAAPI / requestAnimationFrame
עם performance.now); אפשר גם להגדיר window.seek(שניות). הפריים האחרון נשאר עד הסוף."""
import argparse, os, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
import lib

HERE = Path(__file__).resolve().parent
FPS = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--format", default="9:16", choices=["9:16", "16:9", "1:1"])
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--music")
    ap.add_argument("--out")
    a = ap.parse_args()

    seconds = min(max(a.seconds, 2.0), 60.0)
    W, H = lib.FORMATS[a.format]
    tmp = Path(tempfile.mkdtemp(prefix="anim_"))
    frames = tmp / "frames"
    env = dict(os.environ)
    env.setdefault("NODE_PATH", "/usr/local/lib/node_modules_global")
    print("מרנדר פריימים...")
    r = subprocess.run(["node", str(HERE / "animate.mjs"), a.page, str(frames), str(W), str(H), str(FPS), str(seconds)],
                       capture_output=True, text=True, env=env, timeout=20 * 60)
    if r.returncode != 0 or not any(frames.glob("f*.png")):
        sys.exit("רינדור האנימציה נכשל:\n" + (r.stderr or r.stdout)[-2000:])

    ins = ["-framerate", str(FPS), "-i", str(frames / "f%05d.png")]
    if a.music:
        ins += ["-i", a.music]
        fade = ["-af", f"atrim=0:{seconds:.3f},afade=t=out:st={max(seconds - 1.0, 0):.2f}:d=1.0,aformat=channel_layouts=stereo",
                "-map", "0:v", "-map", "1:a"]
        audio = lib.AUDIO_ENC
    else:
        fade, audio = ["-map", "0:v"], []
    dst = lib.out_path(a.page, "animation", a.out)
    lib.ffmpeg(ins + fade + ["-t", f"{seconds:.3f}"] + lib.ENC + audio + [dst])
    print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
