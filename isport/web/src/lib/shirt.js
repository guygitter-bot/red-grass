// כל מה שקשור לחולצה בצד האתר: קוד מוצר, פאצ'ים, ההערה למוכר וחיפוש.
// קוד המוצר כפול ב-api/model.js – לשנות בשניהם.

// "Real Madrid" -> "RealMadrid"
export function codePart(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// "2025/26" -> "26"
export function shortYear(year) {
  const m = String(year ?? '').match(/(\d{2})\D*$/);
  return m ? m[1] : '';
}

// Team-Type-Year-Color
export function autoCode({ team, type, year, color }) {
  return [codePart(team), codePart(type), shortYear(year), codePart(color)].filter(Boolean).join('-');
}

export const KIND_LABEL = { club: 'קבוצה', national: 'נבחרת' };

// הפאצ'ים לפי סוג הקבוצה. en = מה שנכתב בהערה למוכר
export const PATCHES = {
  national: [
    { id: 'none', he: 'ללא פאץ\'', en: '' },
    { id: 'worldcup', he: 'גביע העולם', en: 'World Cup' },
    { id: 'nations', he: 'ליגת האומות', en: 'Nations League' },
    { id: 'euro', he: 'יורו', en: 'Euro' },
  ],
  club: [
    { id: 'none', he: 'ללא פאץ\'', en: '' },
    { id: 'league', he: 'ליגה', en: 'League' },
    { id: 'ucl', he: 'ליגת האלופות', en: 'Champions League' },
    { id: 'uel', he: 'הליגה האירופית', en: 'Europa League' },
    { id: 'uecl', he: 'קונפרנס ליג', en: 'Conference League' },
  ],
};

export const patchesFor = (shirt) => PATCHES[shirt?.kind === 'national' ? 'national' : 'club'];

// שם להדפסה: אותיות (כל שפה), רווח, נקודה, גרש ומקף. עד 15 תווים
export const cleanName = (s) => String(s ?? '').replace(/[^\p{L} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 15);
// מספר: עד שתי ספרות
export const cleanNumber = (s) => String(s ?? '').replace(/\D/g, '').slice(0, 2);

// ההערה למוכר, למשל:
//   Liverpool-Home-26-Red-LongSleeve
//   Name: Israel
//   Number: 10
//   Add League Patches
export function buildNote(shirt, { name = '', number = '', patch = 'none', sleeve = 'short' } = {}) {
  let first = shirt.code;
  if (shirt.longSleeve) first += sleeve === 'long' ? '-LongSleeve' : '-ShortSleeve';
  const lines = [first];
  const n = cleanName(name).trim();
  const num = cleanNumber(number);
  if (n) lines.push(`Name: ${n}`);
  if (num) lines.push(`Number: ${num}`);
  const p = patchesFor(shirt).find((x) => x.id === patch);
  if (p?.en) lines.push(`Add ${p.en} Patches`);
  return lines.join('\n');
}

// ---------- חיפוש ----------

const TYPE_WORDS = { home: 'בית', away: 'חוץ', third: 'שלישית', gk: 'שוער', goalkeeper: 'שוער', special: 'מיוחדת', training: 'אימון', retro: 'רטרו' };

export const typeHe = (type) => TYPE_WORDS[String(type ?? '').toLowerCase()] || '';

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .replace(/[׳'"״]/g, '');

export function haystack(s) {
  return norm(
    [
      s.team, s.teamHe, s.type, typeHe(s.type), s.year, shortYear(s.year), s.color, s.colorHe, s.code,
      s.country, s.countryHe, s.league, s.leagueHe, KIND_LABEL[s.kind], s.kind, ...(s.tags || []),
      s.longSleeve ? 'שרוול ארוך long sleeve' : '',
    ].join(' '),
  );
}

// כל מילה בחיפוש צריכה להופיע איפשהו בחולצה
export function searchShirts(shirts, query, { kind = 'all', league = '' } = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return shirts.filter((s) => {
    if (kind !== 'all' && s.kind !== kind) return false;
    if (league && s.league !== league) return false;
    if (!words.length) return true;
    const h = haystack(s);
    return words.every((w) => h.includes(w));
  });
}

// שם לתצוגה: עברית אם יש, אחרת אנגלית
export const displayName = (s) => s.teamHe || s.team;
export const subtitle = (s) => [typeHe(s.type) ? `${typeHe(s.type)} (${s.type})` : s.type, s.year].filter(Boolean).join(' · ');
