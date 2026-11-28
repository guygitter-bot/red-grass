# גובה קול לכל שורת כתובית בתוכנית – עוזר להפריד בין הנציג/ה לדוגם המצלם.
# שימוש: python3 pitch.py AUDIO.wav plan.json   (או transcript.json – אז לכל segment)
# פלט: זמן, [גובה חציוני בהרץ], הטקסט. בערך: מעל ~190 = קול גבוה (בדרך כלל אישה), מתחת ~160 = קול נמוך.
# ברעש של חנות יש הרבה "-" (לא נמדד) – תמיד לשלב עם ההיגיון של השיחה (מי שואל, מי מסביר).
import json, sys
import numpy as np, librosa

y, sr = librosa.load(sys.argv[1], sr=16000)
data = json.load(open(sys.argv[2]))
lines = ([s for seg in data for s in seg.get("subs", [])] if isinstance(data, list)
         else data["segments"])


def f0(a, b):
    seg = y[int(a * sr):int(b * sr)]
    if len(seg) < 2048:
        return None
    f, v, p = librosa.pyin(seg, fmin=70, fmax=400, sr=sr, frame_length=1024, hop_length=160)
    f = f[v & (p > 0.5)]
    return int(np.median(f)) if len(f) > 3 else None


for s in lines:
    print(f"{s['start']:.1f} [{f0(s['start'], s['end']) or '-'}] {s['text']}", flush=True)
