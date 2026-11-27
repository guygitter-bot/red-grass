// חישובי הסדרה – פונקציות טהורות (נבדקות ב-series.test.js). הכללים זהים לשרת (api/series.js).
// סדרה: teams = [קבוצה עם יתרון ביתיות, קבוצה שנייה], era, players {קוד: שם}, games [{winner, pts {קוד: n}, at}], history

// הקבוצות שאפשר לבחור – הקודים זהים ל-TEAM_CODES בשרת (בדיקה מוודאת). nba = המזהה ללוגו מ-cdn.nba.com
export const TEAM = {
  LAL: { city: "לוס אנג'לס", name: 'לייקרס', short: 'הלייקרס', nba: '1610612747' },
  SAS: { city: 'סן אנטוניו', name: 'ספרס', short: 'הספרס', nba: '1610612759' },
  SAC: { city: 'סקרמנטו', name: 'קינגס', short: 'הקינגס', nba: '1610612758' },
};
export const TEAM_LIST = Object.keys(TEAM);

// סדר 2-2-1-1-1: משחקים 1, 2, 5, 7 אצל הקבוצה עם יתרון הביתיות (teams[0])
const HOME_PATTERN = [0, 0, 1, 1, 0, 1, 0];
export const homeTeam = (teams, i) => teams[HOME_PATTERN[i]];

export const other = (teams, t) => (teams[0] === t ? teams[1] : teams[0]);

const known = (t) => Object.hasOwn(TEAM, t);
const pts = (v) => (Number.isFinite(v) ? v : null);

function safeGames(list, teams) {
  return (Array.isArray(list) ? list : [])
    .filter((g) => g && teams.includes(g.winner))
    .slice(0, 7)
    .map((g) => ({
      winner: g.winner,
      // גם הצורה הישנה (lal / sas) נקראת
      pts: Object.fromEntries(teams.map((t) => [t, pts(g.pts?.[t] ?? g[t.toLowerCase()])])),
      at: Number(g.at) || 0,
    }));
}

function safeHistory(list) {
  return (Array.isArray(list) ? list : [])
    .filter((h) => h && Array.isArray(h.teams) && h.teams.length === 2 && h.teams.every(known))
    .map((h) => ({
      teams: h.teams,
      era: String(h.era || ''),
      players: { ...(h.players || {}) },
      winner: h.teams.includes(h.winner) ? h.winner : null,
      winnerName: String(h.winnerName || ''),
      score: h.score && typeof h.score === 'object' ? h.score : null,
      endedAt: Number(h.endedAt) || 0,
    }));
}

// נתונים מהשרת או מהמכשיר – תמיד בצורה תקינה (גם עותק ישן מהגרסה הראשונה, בלי teams)
export function safeSeries(d) {
  const valid = Array.isArray(d?.teams) && d.teams.length === 2 && d.teams.every(known) && d.teams[0] !== d.teams[1];
  const teams = valid ? [...d.teams] : ['LAL', 'SAS'];
  const era = valid ? String(d.era || '') : '2010';
  const players = Object.fromEntries(teams.map((t) => [t, String(d?.players?.[t] || '')]));
  return {
    teams,
    era,
    players,
    games: safeGames(d?.games, teams),
    history: safeHistory(d?.history),
    rev: Number(d?.rev) || 0,
    // locked = כבר נקבעה סיסמת מאסטר; master = המכשיר הזה מחובר כמאסטר (השרת בודק בכל שינוי)
    locked: !!d?.locked,
    master: !!d?.master,
  };
}

export function wins(s) {
  const w = Object.fromEntries(s.teams.map((t) => [t, 0]));
  for (const g of s.games) if (g.winner in w) w[g.winner]++;
  return w;
}

export function champion(s) {
  const w = wins(s);
  return s.teams.find((t) => w[t] >= 4) || null;
}

// תוצאה כמו 4–1 בתוך טקסט עברי: עטופה בכיוון שמאל-לימין, אחרת הדפדפן הופך אותה ל-1–4
export const score = (a, b) => `\u2066${a}–${b}\u2069`;

// השורה הצהובה שמתחת ללוח, כמו בשידור
export function headline(s) {
  const w = wins(s);
  const ch = champion(s);
  const [a, b] = s.teams;
  const hi = Math.max(w[a], w[b]);
  const lo = Math.min(w[a], w[b]);
  if (ch) return { text: `${TEAM[ch].short} זוכים בסדרה ${score(hi, lo)}`, tone: ch };
  if (!s.games.length) return { text: `הסדרה מתחילה · משחק 1 ב${TEAM[a].city}`, tone: 'even' };
  if (w[a] === w[b]) return { text: `הסדרה שוויונית ${score(w[a], w[b])}`, tone: 'even' };
  const lead = w[a] > w[b] ? a : b;
  return { text: `${TEAM[lead].short} מובילים ${score(hi, lo)}${hi === 3 ? " · נקודת מאצ' לסדרה!" : ''}`, tone: lead };
}

// טקסט לשיתוף: מצב הסדרה במשפט אחד
export function shareText(s) {
  const [a, b] = s.teams;
  const p = s.players;
  const vs = p[a] && p[b] ? `${p[a]} (${TEAM[a].name}) נגד ${p[b]} (${TEAM[b].name})` : `${TEAM[a].name} נגד ${TEAM[b].name}`;
  return `🏀 הסדרה ב-2K: ${vs}\n${headline(s).text}`;
}

// טבלת האלופים: כמה סדרות ניצח כל שחקן (לפי השם), מהרבה לקצת
export function titles(history) {
  const count = new Map();
  for (const h of history) {
    const name = h.winnerName || (h.winner && h.players?.[h.winner]) || '';
    if (name) count.set(name, (count.get(name) || 0) + 1);
  }
  return [...count].map(([name, n]) => ({ name, n })).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'he'));
}

export function gameDate(at) {
  if (!at) return '';
  const d = new Date(at);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
