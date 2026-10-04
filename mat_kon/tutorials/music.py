# מוזיקת רקע לסרטוני ההדרכה – מסונתזת כאן (בלי זכויות יוצרים של אחרים).
# לופ של 60 שניות שמתחבר לעצמו בלי קפיצה: ארפג'ו "פריטה" רך, פד חם, בס ושייקר עדין. C-G-Am-F ב-96 BPM.
# הרצה: pip install numpy && python3 music.py  →  music.wav (ואז ffmpeg ל-music.m4a)
import wave

import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 24  # 24 תיבות = 60 שניות
LENGTH = BARS * BAR
rng = np.random.default_rng(7)

def hz(n):  # מספר תו MIDI -> הרץ
    return 440.0 * 2 ** ((n - 69) / 12)

# אקורדים (MIDI): C, G/B, Am, F – כל אחד שתי תיבות
CHORDS = [
    [48, 55, 60, 64, 67],  # C
    [47, 55, 59, 62, 67],  # G/B
    [45, 52, 57, 60, 64],  # Am
    [41, 53, 57, 60, 65],  # F
]

out = np.zeros(int(SR * (LENGTH + 4)), dtype=np.float64)

def add(sig, t):
    i = int(t * SR)
    end = min(len(out), i + len(sig))
    out[i:end] += sig[: end - i]

def pluck(freq, dur=1.6, amp=0.22):
    # Karplus-Strong: מיתר מנוקש, עם סינון רך
    n = int(SR * dur)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    buf = np.convolve(buf, np.ones(4) / 4, mode='same')
    sig = np.empty(n)
    for i in range(n):
        v = buf[i % period]
        sig[i] = v
        buf[i % period] = 0.4985 * (v + buf[(i + 1) % period])
    env = np.minimum(1, np.arange(n) / (0.004 * SR))
    return amp * sig * env

def pad(freqs, dur, amp=0.07):
    t = np.arange(int(SR * dur)) / SR
    sig = np.zeros_like(t)
    for f in freqs:
        for k, a in ((1, 1.0), (2, 0.35), (3, 0.12)):
            for det in (-0.12, 0.12):
                sig += a * np.sin(2 * np.pi * (f * k + det) * t + rng.uniform(0, 6.28))
    attack = np.minimum(1, t / 0.8)
    release = np.minimum(1, (dur - t) / 0.8)
    return amp * sig * attack * release / len(freqs)

def bass(freq, dur, amp=0.11):
    t = np.arange(int(SR * dur)) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return amp * sig * env

def shaker(amp=0.035):
    n = int(SR * 0.09)
    noise = rng.uniform(-1, 1, n)
    noise = np.diff(noise, prepend=0)  # מסנן גבוהים
    env = np.exp(-np.arange(n) / (0.018 * SR))
    return amp * noise * env

ARP = [0, 1, 2, 3, 2, 1, 0, 1]  # מסלול על צלילי האקורד (שמיניות)

for bar in range(BARS):
    chord = CHORDS[(bar // 2) % len(CHORDS)]
    t0 = bar * BAR
    if bar % 2 == 0:
        add(pad([hz(n) for n in chord[1:4]], 2 * BAR + 0.8), t0)
    add(bass(hz(chord[0] - 12 if chord[0] > 45 else chord[0]), BEAT * 1.8), t0)
    add(bass(hz(chord[0] - 12 if chord[0] > 45 else chord[0]), BEAT * 1.8, 0.08), t0 + 2 * BEAT)
    tones = chord[1:]
    for i, step in enumerate(ARP):
        note = tones[step] + 12
        swing = 0.012 if i % 2 else 0
        accent = 1.0 if i % 4 == 0 else 0.75
        add(pluck(hz(note), amp=0.2 * accent), t0 + i * BEAT / 2 + swing)
    for b in range(4):
        add(shaker(), t0 + b * BEAT + BEAT / 2)

# לופ חלק: הזנב שאחרי 60 שניות מתווסף להתחלה
tail = out[int(SR * LENGTH):].copy()
out = out[: int(SR * LENGTH)]
out[: len(tail)] += tail

# חום קל: low-pass פשוט, ונרמול
out = np.convolve(out, np.ones(3) / 3, mode='same')
out = out / np.max(np.abs(out)) * 0.8
stereo = np.stack([out, np.roll(out, int(0.011 * SR))], axis=1)  # רוחב סטריאו עדין
data = (stereo * 32767).astype('<i2').tobytes()
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data)
print(f'music.wav: {LENGTH:.1f}s')
