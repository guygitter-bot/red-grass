// חוקי המשחק – בלי שרת ובלי אחסון, כדי שיהיה קל לבדוק.
// אותן קטגוריות ואותה בדיקת אות גם באפליקציה (web/src/lib/game.js) – לשנות בשניהם.

export const CATEGORIES = [
  { id: 'country', label: 'ארץ' },
  { id: 'city', label: 'עיר' },
  { id: 'animal', label: 'חי' },
  { id: 'plant', label: 'צומח' },
  { id: 'object', label: 'דומם' },
  { id: 'boy', label: 'ילד' },
  { id: 'girl', label: 'ילדה' },
  { id: 'job', label: 'מקצוע' },
];
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

export const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

// נקודות: תשובה נכונה שרק אחד נתן – 10, אותה תשובה אצל כמה – 5 לכל אחד
export const UNIQUE_POINTS = 10;
export const SHARED_POINTS = 5;
export const MAX_ANSWER = 40;

// תשובה כפי שנשמרת: בלי תווים מוזרים, עד 40 תווים
export function cleanAnswer(s) {
  return String(s ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER);
}

// תשובות אחידות להשוואה: בלי ניקוד, בלי מקפים וסימנים, בלי רווחים כפולים
export function normalize(s) {
  return cleanAnswer(s)
    .normalize('NFC')
    .replace(/[֑-ֽֿ-ׇ]/g, '')
    .replace(/[-־_.,!?;:()"״]/g, ' ')
    .replace(/[׳`’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// מתחילה באות של הסיבוב?
export function startsWithLetter(answer, letter) {
  const first = normalize(answer)[0];
  return !!first && (FINALS[first] || first) === letter;
}

// רק הקטגוריות הידועות, כל תשובה מנוקה
export function cleanAnswers(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!CATEGORY_IDS.has(id)) continue;
    const text = cleanAnswer(value);
    if (text) out[id] = text;
  }
  return out;
}

export const isCategory = (id) => CATEGORY_IDS.has(id);

// אות חדשה שעוד לא הייתה במשחק (כשנגמרות – מתחילים מחדש)
export function pickLetter(used = [], random = Math.random) {
  let options = LETTERS.filter((l) => !used.includes(l));
  if (!options.length) options = LETTERS;
  return options[Math.floor(random() * options.length)];
}

// ניקוד סיבוב.
//   round: { letter, answers: {<שחקן>: {<קטגוריה>: תשובה}}, votes: {'<קטגוריה>|<שחקן>': [מי שפסל]},
//            fixed: {'<קטגוריה>|<תשובה מנורמלת>': תיקון כתיב} }
// תשובה נפסלת כשיותר ממחצית השחקנים האחרים סימנו שהיא לא נכונה.
// מחזיר { rows: {<קטגוריה>: {<שחקן>: {text, typed?, valid, reason, voters, points}}}, totals: {<שחקן>: נקודות} }
// typed = מה שנכתב, כשהכתיב תוקן (text = אחרי התיקון)
export function scoreRound(round, playerIds) {
  const others = playerIds.length - 1;
  const rows = {};
  const totals = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const cat of CATEGORIES) {
    const cells = {};
    const groups = new Map();
    for (const pid of playerIds) {
      const typed = cleanAnswer(round.answers?.[pid]?.[cat.id]);
      const fix = round.fixed?.[`${cat.id}|${normalize(typed)}`];
      const text = fix || typed;
      const norm = normalize(text);
      const voters = (round.votes?.[`${cat.id}|${pid}`] || []).filter((v) => v !== pid && playerIds.includes(v));
      let reason = '';
      if (!norm) reason = 'empty';
      else if (!startsWithLetter(norm, round.letter)) reason = 'letter';
      else if (others > 0 && voters.length * 2 > others) reason = 'voted';
      cells[pid] = { text, ...(fix ? { typed } : {}), valid: !reason, reason, voters, points: 0 };
      if (!reason) groups.set(norm, [...(groups.get(norm) || []), pid]);
    }
    for (const ids of groups.values()) {
      const points = ids.length === 1 ? UNIQUE_POINTS : SHARED_POINTS;
      for (const id of ids) {
        cells[id].points = points;
        totals[id] += points;
      }
    }
    rows[cat.id] = cells;
  }
  return { rows, totals };
}
