#!/usr/bin/env python3
"""חיתוכים על הביט: מזהה קצב במוזיקה (numpy בלבד) ומרכיב עריכה שקופצת בין קליפים בקצב.
שימוש: python3 beats.py clip1.mp4 [clip2.mp4 ...] [--music song.mp3] [--format 9:16|16:9|1:1] [--every auto|1|2|4]
       [--seconds N] [--no-punch] [--bpm N] [--music-start S] [--out ...]"""
import argparse, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "video-tools"))
import lib

SR = 22050
HOP = 512
NFFT = 1024


def decode_mono(path, start=0.0, dur=None):
    """מפענח אודיו למערך float מונו ב-22.05kHz דרך ffmpeg."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-ss", str(start)]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += ["-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    import subprocess
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        sys.exit("פענוח אודיו נכשל: " + r.stderr.decode()[-500:])
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def onset_envelope(y):
    """מעטפת התחלות: שטף ספקטרלי חיובי של STFT בסקאלה לוגריתמית."""
    if len(y) < NFFT * 2:
        return np.zeros(1)
    win = np.hanning(NFFT).astype(np.float32)
    n = 1 + (len(y) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    mag = np.abs(np.fft.rfft(y[idx] * win, axis=1))
    lm = np.log1p(mag * 20.0)
    flux = np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)
    env = np.concatenate([[0.0], flux])
    # הסרת ממוצע מקומי + נרמול
    k = 43
    local = np.convolve(env, np.ones(k) / k, mode="same")
    env = np.maximum(0, env - local)
    m = env.max()
    return env / m if m > 0 else env


def estimate_tempo(env, lo=70.0, hi=180.0):
    """טמפו באוטוקורלציה (עם העדפה עדינה סביב 120) ואז כיוונון עדין של התקופה והפאזה."""
    fps = SR / HOP
    e = env - env.mean()
    n = len(e)
    ac = np.correlate(e, e, mode="full")[n - 1:]
    lmin, lmax = int(fps * 60 / hi), int(fps * 60 / lo)
    lmax = min(lmax, n - 2)
    if lmax <= lmin:
        return 120.0, 0.0
    lags = np.arange(lmin, lmax + 1)
    bpms = 60 * fps / lags
    prior = np.exp(-0.5 * (np.log2(bpms / 120.0) / 0.9) ** 2)
    sc = ac[lmin:lmax + 1] * prior
    p0 = float(lags[int(np.argmax(sc))])
    best = (-1, p0, 0.0)
    for P in np.linspace(p0 * 0.96, p0 * 1.04, 81):
        for ph in np.arange(0, P, 0.5):
            pos = np.arange(ph, n - 1, P)
            i = np.rint(pos).astype(int)
            v = np.maximum.reduce([env[np.clip(i + d, 0, n - 1)] for d in (-1, 0, 1)]).sum()
            if v > best[0]:
                best = (v, P, ph)
    _, P, ph = best
    return 60 * fps / P, ph / fps


def detect_beats(path, start=0.0, dur=None, bpm=None):
    """מחזיר (bpm, זמני ביטים בשניות, עוצמות 0..1) יחסית לתחילת החלון."""
    y = decode_mono(path, start, dur)
    env = onset_envelope(y)
    fps = SR / HOP
    tempo, phase = estimate_tempo(env)
    if bpm:
        # תקופה כפויה: מחפשים רק פאזה
        P = fps * 60 / bpm
        best = (-1, 0)
        n = len(env)
        for ph in np.arange(0, P, 0.5):
            i = np.rint(np.arange(ph, n - 1, P)).astype(int)
            v = np.maximum.reduce([env[np.clip(i + d, 0, n - 1)] for d in (-1, 0, 1)]).sum()
            if v > best[0]:
                best = (v, ph)
        tempo, phase = float(bpm), best[1] / fps
    period = 60.0 / tempo
    total = len(y) / SR
    times = np.arange(phase, total, period)
    # עוצמה לכל ביט: מקסימום מעטפת בסביבה
    st = []
    for t in times:
        i = int(round(t * fps))
        seg = env[max(0, i - 2): i + 3]
        st.append(seg.max() if len(seg) else 0.0)
    st = np.array(st)
    if st.max() > 0:
        st = st / st.max()
    return tempo, times, st


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="קליפים (ואפשר גם קובץ מוזיקה אם מציינים --music)")
    ap.add_argument("--music")
    ap.add_argument("--music-start", type=float, default=0.0)
    ap.add_argument("--format", default="9:16", choices=list(lib.FORMATS))
    ap.add_argument("--every", default="auto", help="חיתוך כל N ביטים: auto|1|2|4|8")
    ap.add_argument("--seconds", type=float)
    ap.add_argument("--no-punch", action="store_true")
    ap.add_argument("--bpm", type=float, help="לכפות טמפו")
    ap.add_argument("--analyze", action="store_true", help="רק להדפיס טמפו וביטים")
    ap.add_argument("--out")
    a = ap.parse_args()

    clips = [p for p in a.inputs if lib.probe(p)["has_video"]]
    if not clips and not a.analyze:
        sys.exit("לא נמצא וידאו")
    audio_src = a.music or (clips[0] if clips else a.inputs[0])
    ainfo = lib.probe(audio_src)
    if not a.music and not ainfo["has_audio"]:
        sys.exit("אין מוזיקה ואין אודיו בקליפ - צריך קובץ מוזיקה")
    avail = max(0.0, ainfo["duration"] - a.music_start)
    T = a.seconds or min(avail if a.music else sum(lib.probe(c)["duration"] for c in clips), 30.0)
    T = min(T, avail) if avail else T
    bpm, times, strength = detect_beats(audio_src, a.music_start, T, a.bpm)
    print(f"טמפו מזוהה: {bpm:.1f} BPM, {len(times)} ביטים ב-{T:.1f} שניות")
    if a.analyze:
        print("ביטים ראשונים:", ", ".join(f"{t:.2f}" for t in times[:12]))
        return

    every = (4 if bpm >= 140 else 2 if bpm >= 100 else 1) if a.every == "auto" else int(a.every)
    # נקודות חיתוך: תחילת הסרטון ואז כל N ביטים; ממזגים קטעים קצרים מדי
    cuts, strong = [0.0], [1.0]
    thr = float(np.median(strength)) if len(strength) else 0.5
    for k in range(0, len(times), every):
        t = float(times[k])
        if t - cuts[-1] >= 0.45 and t < T - 0.4:
            cuts.append(t)
            strong.append(float(strength[k]))
    cuts.append(T)
    segs = [(cuts[i], cuts[i + 1] - cuts[i], strong[i]) for i in range(len(cuts) - 1)]
    print(f"{len(segs)} קטעים, חיתוך כל {every} ביטים")

    W, H = lib.FORMATS[a.format]
    FPS = 30
    infos = {c: lib.probe(c) for c in clips}
    cursor = {c: 0.0 for c in clips}
    inputs, fc, labels = [], [], []
    for i, (st, d, s) in enumerate(segs):
        c = clips[i % len(clips)]
        cd = infos[c]["duration"]
        if cursor[c] + d > cd:
            cursor[c] = 0.0
        ss = cursor[c]
        cursor[c] += d
        inputs += ["-ss", f"{ss:.3f}", "-t", f"{d + 0.1:.3f}", "-i", c]
        chain = f"[{i}:v]setpts=PTS-STARTPTS,fps={FPS},{lib.fit_filter(W, H)}"
        if d > cd:  # הקליפ קצר מהקטע: מקפיאים את הפריים האחרון
            chain += f",tpad=stop_mode=clone:stop_duration={d:.2f}"
        if not a.no_punch and (s >= max(thr, 0.5) or i == 0):
            # פאנץ' זום מהיר בפתיחת הקטע
            chain += (f",scale=w='trunc(iw*(1+0.13*max(0,1-t/0.22))/2)*2':h='trunc(ih*(1+0.13*max(0,1-t/0.22))/2)*2'"
                      f":eval=frame,crop={W}:{H}")
        chain += f",trim=duration={d:.3f},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{i}]"
        fc.append(chain)
        labels.append(f"[v{i}]")
    fc.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=0,fade=t=out:st={max(0, T - 0.8):.2f}:d=0.8[vout]")
    # אודיו: המוזיקה (או האודיו של הקליפ הראשון) עם דעיכה בסוף
    ain = ["-ss", str(a.music_start), "-t", f"{T:.3f}", "-i", audio_src]
    fc.append(f"[{len(segs)}:a]atrim=0:{T:.3f},afade=t=out:st={max(0, T - 1.2):.2f}:d=1.2[aout]")
    dst = lib.out_path(clips[0], "beats", a.out)
    lib.ffmpeg(inputs + ain + ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
                              "-t", f"{T:.3f}"] + lib.ENC + lib.AUDIO_ENC + [dst])
    print("OUTPUT:", dst)


if __name__ == "__main__":
    main()
