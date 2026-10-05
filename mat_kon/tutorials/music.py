# מוזיקת רקע לסרטוני ההדרכה – מסונתזת כאן (בלי זכויות יוצרים של אחרים).
# לופ של 60 שניות שמתחבר לעצמו בלי קפיצה: קצבי ושמח (פופ קליל, 120 BPM) – תוף בס, קלאפ, היי-האט, בס קופצני
# ואקורדים קצרים. הצלילים מסוננים ורכים בתחום של הדיבור, כדי שהקול יישמע ברור מעל המוזיקה.
# הרצה: pip install numpy && python3 music.py  →  music.wav (ואז: ffmpeg -i music.wav -c:a aac -b:a 128k music.m4a)
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 30  # 30 תיבות = 60 שניות
LENGTH = BARS * BAR
rng = np.random.default_rng(11)

def hz(n):  # מספר תו MIDI -> הרץ
    return 440.0 * 2 ** ((n - 69) / 12)

# אקורדים (MIDI): C – Am – F – G, כל אחד תיבה
CHORDS = [
    [48, 60, 64, 67],  # C
    [45, 57, 60, 64],  # Am
    [41, 57, 60, 65],  # F
    [43, 55, 59, 62],  # G
]

out = np.zeros(int(SR * (LENGTH + 2)), dtype=np.float64)

def add(sig, t):
    i = int(t * SR)
    end = min(len(out), i + len(sig))
    out[i:end] += sig[: end - i]

def lowpass(sig, cutoff):  # מסנן פשוט מסדר ראשון (מרכך צלילים גבוהים)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(sig)
    acc = 0.0
    for i, v in enumerate(sig):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y

def kick(amp=0.55):
    t = np.arange(int(SR * 0.28)) / SR
    freq = 50 + 90 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return amp * np.sin(phase) * np.exp(-t * 11)

def clap(amp=0.16):
    n = int(SR * 0.16)
    noise = np.diff(rng.uniform(-1, 1, n), prepend=0)
    t = np.arange(n) / SR
    env = np.exp(-t * 26) * (1 + 0.6 * np.sin(2 * np.pi * 90 * t).clip(0))
    return amp * noise * env

def hat(amp=0.05, open_=False):
    n = int(SR * (0.12 if open_ else 0.04))
    noise = np.diff(np.diff(rng.uniform(-1, 1, n), prepend=0), prepend=0)
    t = np.arange(n) / SR
    return amp * noise * np.exp(-t * (30 if open_ else 90))

def bass(freq, dur, amp=0.22):
    t = np.arange(int(SR * dur)) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t) + 0.1 * np.sin(6 * np.pi * freq * t)
    env = np.minimum(1, t / 0.005) * np.minimum(1, (dur - t) / 0.02) * np.exp(-t * 3)
    return amp * sig * env

def stab(freqs, dur, amp=0.06):  # אקורד קצר ורך (מסור מסונן)
    t = np.arange(int(SR * dur)) / SR
    sig = np.zeros_like(t)
    for f in freqs:
        for det in (-0.25, 0.25):
            ph = (f + det) * t + rng.uniform(0, 1)
            sig += 2 * (ph % 1) - 1
    env = np.minimum(1, t / 0.006) * np.exp(-t * 7)
    return amp * lowpass(sig / len(freqs), 1500) * env

def bell(freq, dur=0.5, amp=0.05):  # צליל פעמון קטן למנגינה
    t = np.arange(int(SR * dur)) / SR
    sig = np.sin(2 * np.pi * freq * t + 1.2 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 8))
    return amp * sig * np.minimum(1, t / 0.003) * np.exp(-t * 6)

# מנגינה קצרה של שתי תיבות על צלילי האקורד (מוצגת רק בחלק מהתיבות, כדי לא להעמיס)
HOOK = [(0, 0), (1.5, 2), (2, 1), (3, 2)]  # (פעמה, צליל באקורד)

for bar in range(BARS):
    chord = CHORDS[bar % len(CHORDS)]
    t0 = bar * BAR
    intro = bar < 2  # פתיחה עדינה: בלי תוף בס
    for b in range(4):
        tb = t0 + b * BEAT
        if not intro:
            add(kick(), tb)
        if b in (1, 3):
            add(clap(), tb)
        add(hat(), tb + BEAT / 2)
        add(hat(0.025), tb + BEAT / 4 * 3)
    add(hat(0.04, open_=True), t0 + 3.5 * BEAT)
    # בס בשמיניניות, קופצני (תו נמוך ואוקטבה)
    root = hz(chord[0] - 12 if chord[0] > 44 else chord[0])
    for i in range(8):
        f = root * (2 if i in (3, 7) else 1)
        add(bass(f, BEAT / 2 * 0.85, 0.2 if i % 2 == 0 else 0.15), t0 + i * BEAT / 2)
    # אקורדים על הנקישות שבין הפעמות
    for off in (0.5, 1.5, 2.75, 3.5):
        add(stab([hz(n) for n in chord[1:]], 0.22), t0 + off * BEAT)
    if bar % 4 in (2, 3) and not intro:
        for beat, idx in HOOK:
            add(bell(hz(chord[1:][idx] + 12)), t0 + beat * BEAT)

# לופ חלק: הזנב שאחרי 60 שניות מתווסף להתחלה
tail = out[int(SR * LENGTH):].copy()
out = out[: int(SR * LENGTH)]
out[: len(tail)] += tail

out = out / np.max(np.abs(out)) * 0.85
stereo = np.stack([out, np.roll(out, int(0.009 * SR))], axis=1)  # רוחב סטריאו עדין
data = (stereo * 32767).astype('<i2').tobytes()
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data)
print(f'music.wav: {LENGTH:.1f}s')
