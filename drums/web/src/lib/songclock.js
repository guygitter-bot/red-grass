// שעון השיר: זמן הנגינה של סרטון היוטיוב (שניות), חלק יותר ממה שהנגן מחזיר.
// הנגן מעדכן את getCurrentTime לא בתדירות גבוהה, אז בין קריאות משלימים לפי השעון של הדפדפן ובקצב הנגינה.
// apiRef.current = { getTime, isPlaying, getRate } (נקבע ב-SongPlayer כשהנגן מוכן).

const POLL_MS = 100; // כל כמה זמן שואלים את הנגן
const TOLERANCE = 0.15; // סטייה (שניות) שמעליה מתאימים מחדש (דילוג בשיר, האטה וכו')

export function createSongClock(apiRef) {
  let anchor = null; // { vt, at, rate }
  let lastRead = 0;
  let cached = null; // { vt, playing, rate }

  function read(nowMs) {
    const api = apiRef.current;
    if (!api) {
      cached = null;
      return;
    }
    try {
      cached = { vt: api.getTime(), playing: api.isPlaying(), rate: api.getRate() || 1 };
    } catch {
      cached = null;
    }
    lastRead = nowMs;
  }

  return {
    // { time, playing } או null אם אין נגן מוכן
    sample() {
      const nowMs = performance.now();
      if (nowMs - lastRead >= POLL_MS) read(nowMs);
      if (!cached) {
        anchor = null;
        return null;
      }
      if (!cached.playing) {
        anchor = null;
        return { time: cached.vt, playing: false };
      }
      const pred = anchor ? anchor.vt + ((nowMs - anchor.at) / 1000) * anchor.rate : null;
      if (pred === null || Math.abs(pred - cached.vt - ((nowMs - lastRead) / 1000) * cached.rate) > TOLERANCE) {
        // מתאימים מחדש: הערך שנקרא כבר "ישן" ב-(עכשיו - זמן הקריאה)
        anchor = { vt: cached.vt + ((nowMs - lastRead) / 1000) * cached.rate, at: nowMs, rate: cached.rate };
      }
      return { time: anchor.vt + ((nowMs - anchor.at) / 1000) * anchor.rate, playing: true };
    },
  };
}
