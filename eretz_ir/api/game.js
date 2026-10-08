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
  { id: 'food', label: 'מאכל' },
];
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

export const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

// נקודות: תשובה נכונה שרק אחד נתן – 10, אותה תשובה אצל כמה – 5 לכל אחד
export const UNIQUE_POINTS = 10;
export const SHARED_POINTS = 5;
// מי שלחץ ראשון "סיימתי" עם כל השדות מלאים – בונוס, אם לפחות מחצית מהתשובות שלו נכונות
export const FIRST_BONUS = 10;
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

// לפחות שתי אותיות (אות אחת לבד – לא תשובה)
export function longEnough(answer) {
  return normalize(answer).replace(/[^\u05d0-\u05eaa-z0-9]/g, '').length >= 2;
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

// אות חדשה שעוד לא הייתה במשחק (כשנגמרות – מתחילים מחדש).
// recent = אותיות שהיו לאחרונה במשחקים קודמים במכשיר של מי שלחץ "התחל" – גם אותן מנסים לדלג
export function pickLetter(used = [], random = Math.random, recent = []) {
  let options = LETTERS.filter((l) => !used.includes(l));
  if (!options.length) options = LETTERS;
  const fresh = options.filter((l) => !recent.includes(l));
  if (fresh.length) options = fresh;
  return options[Math.floor(random() * options.length)];
}

// ניקוד סיבוב.
//   round: { letter, answers: {<שחקן>: {<קטגוריה>: תשובה}}, votes: {'<קטגוריה>|<שחקן>': [מי שפסל]},
//            fixed: {'<קטגוריה>|<תשובה מנורמלת>': תיקון כתיב}, wrong: [<אותו מפתח> – לא מתאים לקטגוריה],
//            approves: {'<קטגוריה>|<שחקן>': [מי שאישר]} }
// תשובה נפסלת כשיותר ממחצית השחקנים האחרים סימנו שהיא לא נכונה.
// תשובה שהבודק (Claude) קבע שלא מתאימה – 0, אלא אם יותר ממחצית השחקנים האחרים אישרו אותה.
// מחזיר { rows: {<קטגוריה>: {<שחקן>: {text, typed?, valid, reason, voters, approvers, points}}}, totals: {<שחקן>: נקודות} }
// reason: empty | letter | short | wrong | voted
// round.first = מי שסיים ראשון (עם כל השדות). מחזיר גם bonus: {id, points} כשמגיע לו בונוס
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
      const key = `${cat.id}|${normalize(typed)}`;
      const fix = round.fixed?.[key];
      const text = fix || typed;
      const norm = normalize(text);
      const fromOthers = (list) => (list || []).filter((v) => v !== pid && playerIds.includes(v));
      const voters = fromOthers(round.votes?.[`${cat.id}|${pid}`]);
      const approvers = fromOthers(round.approves?.[`${cat.id}|${pid}`]);
      const majority = (list) => others > 0 && list.length * 2 > others;
      let reason = '';
      if (!norm) reason = 'empty';
      else if (!startsWithLetter(norm, round.letter)) reason = 'letter';
      else if (!longEnough(norm)) reason = 'short';
      else if (round.wrong?.includes(key) && !majority(approvers)) reason = 'wrong';
      else if (majority(voters)) reason = 'voted';
      cells[pid] = { text, ...(fix ? { typed } : {}), valid: !reason, reason, voters, approvers, points: 0 };
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
  let bonus = null;
  if (round.first && playerIds.includes(round.first)) {
    const valid = CATEGORIES.filter((c) => rows[c.id][round.first].valid).length;
    if (valid * 2 >= CATEGORIES.length) {
      bonus = { id: round.first, points: FIRST_BONUS };
      totals[round.first] += FIRST_BONUS;
    }
  }
  return { rows, totals, bonus };
}
