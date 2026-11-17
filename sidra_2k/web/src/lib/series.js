// חישובי הסדרה – פונקציות טהורות (נבדקות ב-series.test.js). הכללים זהים לשרת (api/series.js).

export const TEAM = {
  LAL: { city: "לוס אנג'לס", name: 'לייקרס', short: 'הלייקרס' },
  SAS: { city: 'סן אנטוניו', name: 'ספרס', short: 'הספרס' },
};

// סדר 2-2-1-1-1: יתרון ביתיות ללייקרס (משחקים 1-2 בלוס אנג'לס)
export const HOME = ['LAL', 'LAL', 'SAS', 'SAS', 'LAL', 'SAS', 'LAL'];

export const other = (t) => (t === 'LAL' ? 'SAS' : 'LAL');

// נתונים מהשרת או מהמכשיר – תמיד בצורה תקינה (גם אם חסר שדה)
export function safeSeries(d) {
  const players = { LAL: String(d?.players?.LAL || ''), SAS: String(d?.players?.SAS || '') };
  const games = (Array.isArray(d?.games) ? d.games : [])
    .filter((g) => g && (g.winner === 'LAL' || g.winner === 'SAS'))
    .slice(0, 7)
    .map((g) => ({ winner: g.winner, lal: Number.isFinite(g.lal) ? g.lal : null, sas: Number.isFinite(g.sas) ? g.sas : null, at: Number(g.at) || 0 }));
  // locked = כבר נקבעה סיסמת מאסטר; master = המכשיר הזה מחובר כמאסטר (השרת בודק בכל שינוי)
  return { players, games, rev: Number(d?.rev) || 0, locked: !!d?.locked, master: !!d?.master };
}

export function wins(games) {
  const w = { LAL: 0, SAS: 0 };
  for (const g of games) w[g.winner]++;
  return w;
}

export function champion(games) {
  const w = wins(games);
  return w.LAL >= 4 ? 'LAL' : w.SAS >= 4 ? 'SAS' : null;
}

// השורה הצהובה שמתחת ללוח, כמו בשידור
export function headline(games) {
  const w = wins(games);
  const ch = champion(games);
  const hi = Math.max(w.LAL, w.SAS);
  const lo = Math.min(w.LAL, w.SAS);
  if (ch) return { text: `${TEAM[ch].short} זוכים בסדרה ${hi}–${lo}`, tone: ch };
  if (!games.length) return { text: "הסדרה מתחילה · משחק 1 בלוס אנג'לס", tone: 'even' };
  if (w.LAL === w.SAS) return { text: `הסדרה שוויונית ${w.LAL}–${w.SAS}`, tone: 'even' };
  const lead = w.LAL > w.SAS ? 'LAL' : 'SAS';
  return { text: `${TEAM[lead].short} מובילים ${hi}–${lo}${hi === 3 ? " · נקודת מאצ' לסדרה!" : ''}`, tone: lead };
}

export function gameDate(at) {
  if (!at) return '';
  const d = new Date(at);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

// טקסט לשיתוף: מצב הסדרה במשפט אחד
export function shareText(series) {
  const p = series.players;
  const vs = p.LAL && p.SAS ? `${p.LAL} (לייקרס) נגד ${p.SAS} (ספרס)` : 'לייקרס נגד ספרס';
  return `🏀 הסדרה ב-2K: ${vs}\n${headline(series.games).text}`;
}
