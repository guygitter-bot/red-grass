// חוקי המשחק: בחירת שירים, ארבע תשובות, ניקוד, ו-50:50.
import { DECADES, SONGS, SONG_BY_ID } from './songs.js';

export const ERAS = ['all', ...DECADES];
export const LANGS = ['both', 'il', 'intl'];
export const COUNTS = [10, 20];
export const MODES = ['solo', 'teams'];
export const DEFAULT_SETTINGS = { mode: 'solo', era: 'all', lang: 'both', count: 10 };
// תשובה נכונה – 10 נקודות; אם ביקשת הארכה (10 שניות במקום 5) – 5 נקודות
export const POINTS = 10;
export const POINTS_EXTENDED = 5;
// כל 30 נקודות שצברת = 50:50 אחד (מוחק שתי תשובות לא נכונות)
export const JOKER_EVERY = 30;

export function cleanSettings(raw, old = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...old };
  if (MODES.includes(raw?.mode)) s.mode = raw.mode;
  if (ERAS.includes(raw?.era)) s.era = raw.era;
  if (LANGS.includes(raw?.lang)) s.lang = raw.lang;
  if (COUNTS.includes(Number(raw?.count))) s.count = Number(raw.count);
  return s;
}

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// כמה רחוק עשור מעשור (כדי להשלים מהעשורים הקרובים כשאין מספיק שירים)
const distance = (a, b) => Math.abs(DECADES.indexOf(a) - DECADES.indexOf(b));

// שירים למשחק: קודם כאלה שעוד לא היו בחדר הזה, ואם אין מספיק – מהעשורים הקרובים, ורק בסוף גם שירים שכבר היו.
// מחזיר יותר מ-count, כי חלק מהשירים אולי לא יימצאו להשמעה.
export function pickSongs({ era, lang, count }, used = [], random = Math.random, extra = 8) {
  const want = count + extra;
  const usedSet = new Set(used);
  const langOk = (s) => lang === 'both' || s.lang === lang;
  const groups = [];
  if (era === 'all') groups.push(SONGS.filter(langOk));
  else {
    const byDistance = [...DECADES].sort((a, b) => distance(a, era) - distance(b, era));
    for (const d of byDistance) groups.push(SONGS.filter((s) => langOk(s) && s.decade === d));
  }
  const fresh = [];
  const old = [];
  for (const g of groups) {
    const mixed = shuffle(g, random);
    fresh.push(...mixed.filter((s) => !usedSet.has(s.id)));
    old.push(...mixed.filter((s) => usedSet.has(s.id)));
  }
  // מהעשור שנבחר – כמה שיותר; מהקרובים רק כדי להשלים
  return [...fresh, ...old].slice(0, want);
}

// שם להשוואה: בלי ניקוד וסימנים, בלי מה שבסוגריים ובלי רווחים
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/["'״׳`’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export const compact = (s) => norm(s).replace(/ /g, '');

// שלוש תשובות לא נכונות: באותה שפה (אחרת קל מדי), עדיף מאותו עשור, ובלי שם שיר כפול
export function makeOptions(song, random = Math.random) {
  const same = SONGS.filter((s) => s.lang === song.lang && s.id !== song.id && compact(s.title) !== compact(song.title));
  const near = shuffle(same, random).sort((a, b) => distance(a.decade, song.decade) - distance(b.decade, song.decade));
  const wrong = [];
  const titles = new Set([compact(song.title)]);
  // קודם מאותו עשור; בעשור עם מעט שירים – גם מהקרובים
  for (const s of near) {
    if (titles.has(compact(s.title))) continue;
    titles.add(compact(s.title));
    wrong.push(s.id);
    if (wrong.length === 3) break;
  }
  const options = shuffle([song.id, ...wrong], random);
  return { options, correct: options.indexOf(song.id) };
}

export const songLabel = (id) => {
  const s = SONG_BY_ID.get(id);
  return s ? { title: s.title, artist: s.artist } : { title: '?', artist: '' };
};

// נקודות לתשובה אחת
export function pointsFor(pick, correct) {
  if (!pick || pick.c !== correct) return 0;
  return pick.ext ? POINTS_EXTENDED : POINTS;
}

// ניקוד במשחק (עד השאלה upTo, לא כולל) + כמה 50:50 נשארו
export function scoreGame(game, playerIds, upTo = game.ids.length) {
  const out = {};
  for (const id of playerIds) {
    const picks = game.picks[id] || [];
    let total = 0;
    let right = 0;
    let used = 0;
    for (let q = 0; q < game.ids.length; q++) {
      const p = picks[q];
      if (p?.cut) used++;
      if (q >= upTo) continue;
      const pts = pointsFor(p, game.correct[q]);
      total += pts;
      if (pts) right++;
    }
    out[id] = { total, right, jokers: Math.max(0, Math.floor(total / JOKER_EVERY) - used) };
  }
  return out;
}

// ניקוד לקבוצות: ממוצע של השחקנים בקבוצה (כדי שקבוצה גדולה לא תנצח רק כי יש בה יותר אנשים)
export function teamScores(players, totals) {
  return [0, 1].map((team) => {
    const members = players.filter((p) => p.team === team);
    const sum = members.reduce((a, p) => a + (totals[p.id] || 0), 0);
    return { team, members: members.length, total: members.length ? Math.round(sum / members.length) : 0 };
  });
}
