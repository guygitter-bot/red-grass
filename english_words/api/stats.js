// סיכום התוצאות של ילד אחד לכל שלב (פונקציה טהורה – נבדקת בלי שרת)
export const PASS = 80;
export const MODES = ['words', 'sentences'];

export function summarize(rounds) {
  const out = {};
  for (const mode of MODES) {
    const list = rounds.filter((r) => r.mode === mode).sort((a, b) => a.at - b.at);
    const firstPass = list.findIndex((r) => r.percent >= PASS);
    const missed = {};
    for (const r of list) for (const w of r.wrong || []) missed[w] = (missed[w] || 0) + 1;
    out[mode] = {
      attempts: list.length,
      passed: firstPass >= 0,
      // כמה סיבובים עד שהגיע ל-80% (כולל הסיבוב שעבר)
      attemptsToPass: firstPass >= 0 ? firstPass + 1 : null,
      best: list.length ? Math.max(...list.map((r) => r.percent)) : null,
      average: list.length ? Math.round(list.reduce((s, r) => s + r.percent, 0) / list.length) : null,
      last: list.length ? list[list.length - 1].percent : null,
      missed: Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([en, times]) => ({ en, times })),
    };
  }
  return out;
}

// בדיקת סיבוב שנשלח מהאפליקציה – לא סומכים על מה שמגיע
export function cleanRound(r, now) {
  if (!r || typeof r !== 'object') return null;
  const mode = MODES.includes(r.mode) ? r.mode : null;
  const total = Number.isInteger(r.total) ? r.total : NaN;
  const correct = Number.isInteger(r.correct) ? r.correct : NaN;
  if (!mode || !(total >= 1 && total <= 100) || !(correct >= 0 && correct <= total)) return null;
  const wrong = (Array.isArray(r.wrong) ? r.wrong : [])
    .filter((w) => typeof w === 'string').map((w) => w.slice(0, 60)).slice(0, 100);
  const at = Number.isFinite(r.at) && r.at > 0 && r.at <= now + 60_000 ? Math.floor(r.at) : now;
  return { mode, total, correct, percent: Math.round((correct / total) * 100), wrong, at };
}

export function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30) || 'ילד/ה';
}
