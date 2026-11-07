#!/usr/bin/env python3
"""שואוריל / גרפיקת תנועה: כותרות קינטיות בעברית (HTML+Playwright), מעברים בין קליפים, HUD טכנולוגי עם זוהר.
שימוש: python3 make.py [clip1.mp4 clip2.mp4 ...] --lines "שורה 1" "שורה 2 | כותרת משנה" [--accent "#19a8ff"]
       [--format 9:16|16:9|1:1] [--scene-seconds 3] [--music song.mp3] [--title-card] [--out ...]
בלי קליפים: כל סצנה על רקע טכנולוגי כהה. "טקסט | משנה" יוצר תג משנה שנכנס מהצד."""
import argparse, json, os, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
import lib

HERE = Path(__file__).resolve().parent
TRANS = ["slideright", "circleopen", "zoomin", "smoothleft", "radial", "wipeleft"]
FPS = 30
X = 0.5  # משך המעבר


def node_render(cfg, outdir):
    cp = Path(outdir).parent / f"cfg_{cfg['mode']}.json"
    cp.write_text(json.dumps(cfg, ensure_ascii=False))
    env = dict(os.environ)
    env.setdefault("NODE_PATH", "/usr/local/lib/node_modules_global")
    r = subprocess.run(["node", str(HERE / "render.mjs"), str(cp), str(outdir)], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        sys.exit("רינדור HTML נכשל:\n" + r.stderr[-2000:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clips", nargs="*")
    ap.add_argument("--lines", nargs="+", default=[])
    ap.add_argument("--accent", default="#19a8ff")
    ap.add_argument("--format", default="9:16", choices=list(lib.FORMATS))
    ap.add_argument("--scene-seconds", type=float, default=3.0)
    ap.add_argument("--music")
    ap.add_argument("--title-card", action="store_true", help="הסצנה הראשונה על רקע טכנולוגי (בלי קליפ)")
    ap.add_argument("--out")
    a = ap.parse_args()

    clips = [c for c in a.clips if lib.probe(c)["has_video"]]
    N = max(len(a.lines), len(clips), 1)
    S = max(2.0, a.scene_seconds)
    W, H = lib.FORMATS[a.format]
    D = N * S - (N - 1) * X
    tmp = Path(tempfile.mkdtemp(prefix="mg_"))
    infos = {c: lib.probe(c) for c in clips}

    scenes = []
    for i in range(N):
        has = bool(clips) and not (a.title_card and i == 0)
        scenes.append({"text": a.lines[i] if i < len(a.lines) else "", "hasClip": has})
    base = {"W": W, "H": H, "fps": FPS, "duration": D, "accent": a.accent, "scenes": scenes,
            "sceneSeconds": S, "xfade": X}
    need_bg = any(not s["hasClip"] for s in scenes)
    if need_bg:  # רקע גדול ב-25% כדי שאפשר יהיה לסחוף עליו
        node_render({**base, "mode": "bg", "W": int(W * 1.25) // 2 * 2, "H": int(H * 1.25) // 2 * 2}, tmp / "bg")
    print("מרנדר כותרות...")
    node_render({**base, "mode": "overlay"}, tmp / "frames")

    ins, vch, ach = [], [], []
    cursor = {c: 0.0 for c in clips}
    ci = 0
    idx = 0
    for i, sc in enumerate(scenes):
        if sc["hasClip"]:
            c = clips[ci % len(clips)]
            ci += 1
            cd = infos[c]["duration"]
            if cursor[c] + S > cd:
                cursor[c] = 0.0
            ss = cursor[c]
            cursor[c] += S
            ins += ["-ss", f"{ss:.3f}", "-t", f"{S + 0.3:.3f}", "-i", c]
            z = f"(1+0.06*t/{S})"
            vch.append(f"[{idx}:v]setpts=PTS-STARTPTS,fps={FPS},{lib.fit_filter(W, H)},"
                       f"scale=w='trunc({W}*{z}/2)*2':h='trunc({H}*{z}/2)*2':eval=frame,crop={W}:{H},"
                       f"eq=brightness=-0.05:saturation=1.1:contrast=1.05,colorbalance=bs=0.05:bh=0.03,"
                       f"tpad=stop_mode=clone:stop_duration={S:.2f},trim=duration={S:.3f},setpts=PTS-STARTPTS,"
                       f"setsar=1,format=yuv420p[s{i}]")
            if infos[c]["has_audio"]:
                ach.append(f"[{idx}:a]aresample=44100,apad=whole_dur={S:.2f},atrim=0:{S:.3f},asetpts=PTS-STARTPTS,"
                           f"aformat=channel_layouts=stereo[a{i}]")
            else:
                ach.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{S:.3f},asetpts=PTS-STARTPTS[a{i}]")
        else:
            ins += ["-loop", "1", "-framerate", str(FPS), "-t", f"{S:.3f}", "-i", str(tmp / "bg" / "bg.png")]
            vch.append(f"[{idx}:v]format=yuv420p,crop={W}:{H}:x='(iw-{W})*(0.5+0.4*sin(t*0.5+{i}))':"
                       f"y='(ih-{H})*(0.5+0.4*cos(t*0.4+{i}))',setsar=1[s{i}]")
            ach.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{S:.3f},asetpts=PTS-STARTPTS[a{i}]")
        idx += 1
    # מעברים בין הסצנות
    cur_v, cur_a = "s0", "a0"
    for i in range(1, N):
        tr = TRANS[(i - 1) % len(TRANS)]
        vch.append(f"[{cur_v}][s{i}]xfade=transition={tr}:duration={X}:offset={i * (S - X):.3f}[x{i}]")
        ach.append(f"[{cur_a}][a{i}]acrossfade=d={X}:c1=tri:c2=tri[ax{i}]")
        cur_v, cur_a = f"x{i}", f"ax{i}"
    ins += ["-framerate", str(FPS), "-i", str(tmp / "frames" / "f%05d.png")]
    ov = idx
    vch.append(f"[{ov}:v]format=rgba[ov]")
    vch.append(f"[{cur_v}][ov]overlay=0:0:format=auto,fade=t=in:st=0:d=0.3,fade=t=out:st={D - 0.6:.2f}:d=0.6,format=yuv420p[vout]")
    if a.music:
        ins += ["-i", a.music]
        ach.append(f"[{ov + 1}:a]atrim=0:{D:.3f},afade=t=out:st={D - 1.0:.2f}:d=1.0,aformat=channel_layouts=stereo[aout]")
    else:
        ach.append(f"[{cur_a}]afade=t=in:st=0:d=0.2,afade=t=out:st={D - 0.6:.2f}:d=0.6[aout]")
    dst = lib.out_path(clips[0] if clips else "showreel.mp4", "showreel", a.out)
    lib.ffmpeg(ins + ["-filter_complex", ";".join(vch + ach), "-map", "[vout]", "-map", "[aout]", "-t", f"{D:.3f}"]
               + lib.ENC + lib.AUDIO_ENC + [dst])
    print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
