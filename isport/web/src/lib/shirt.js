// כל מה שקשור למוצר בצד האתר: קטגוריות, קוד מוצר, פאצ'ים, ההערה למוכר וחיפוש.
// קוד המוצר והקטגוריות כפולים ב-api/model.js – לשנות בשניהם.

// סוגי קטגוריות: מה אפשר להתאים אישית, ואיך קוראים לשדות במסך הניהול
export const TEMPLATES = {
  football: { label: 'חולצת כדורגל (שם, מספר, פאץ\', שרוול)', custom: true, patches: true, sleeves: true },
  basketball: { label: 'גופיית כדורסל (שם, מספר)', custom: true, patches: false, sleeves: false },
  plain: { label: 'מוצר רגיל (בלי התאמה אישית)', custom: false, patches: false, sleeves: false },
};
export const templateInfo = (t) => TEMPLATES[t] || TEMPLATES.plain;

export const DEFAULT_CATEGORIES = [
  { id: 'football', name: 'חולצות כדורגל', template: 'football', active: true },
  { id: 'basketball', name: 'גופיות כדורסל', template: 'basketball', active: true },
  { id: 'shoes', name: 'נעליים', template: 'plain', active: true },
  { id: 'bags', name: 'תיקים', template: 'plain', active: true },
];

// מוסיף לכל מוצר את שם הקטגוריה וסוגה (מוצר ישן בלי קטגוריה = חולצת כדורגל)
export function withCategories(shirts, categories = DEFAULT_CATEGORIES) {
  return shirts.map((s) => {
    const c = categories.find((x) => x.id === (s.category || 'football'));
    return { ...s, category: s.category || 'football', categoryName: c?.name || '', template: c?.template || 'football' };
  });
}

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

export const patchesFor = (shirt) =>
  templateInfo(shirt?.template || 'football').patches ? PATCHES[shirt?.kind === 'national' ? 'national' : 'club'] : [];

// שם להדפסה: אותיות (כל שפה), רווח, נקודה, גרש ומקף. עד 15 תווים
export const cleanName = (s) => String(s ?? '').replace(/[^\p{L} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 15);
// מספר: עד שתי ספרות
export const cleanNumber = (s) => String(s ?? '').replace(/\D/g, '').slice(0, 2);

// ההערה למוכר, למשל:
//   Liverpool-Home-26-Red-LongSleeve
//   Name: Israel
//   Number: 10
//   Add League Patches
// מוצר רגיל (נעליים, תיקים…): רק הקוד
export function buildNote(shirt, { name = '', number = '', patch = 'none', sleeve = 'short' } = {}) {
  const t = templateInfo(shirt.template || 'football');
  if (!t.custom) return shirt.code;
  let first = shirt.code;
  if (t.sleeves && shirt.longSleeve) first += sleeve === 'long' ? '-LongSleeve' : '-ShortSleeve';
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
      s.country, s.countryHe, s.league, s.leagueHe, s.template === 'plain' ? '' : KIND_LABEL[s.kind], s.kind, ...(s.tags || []),
      s.longSleeve ? 'שרוול ארוך long sleeve' : '', s.categoryName,
    ].join(' '),
  );
}

// כל מילה בחיפוש צריכה להופיע איפשהו בחולצה
export function searchShirts(shirts, query, { kind = 'all', league = '', category = '' } = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return shirts.filter((s) => {
    if (category && (s.category || 'football') !== category) return false;
    if (kind !== 'all' && (s.kind !== kind || s.template === 'plain')) return false;
    if (league && s.league !== league) return false;
    if (!words.length) return true;
    const h = haystack(s);
    return words.every((w) => h.includes(w));
  });
}

// שם לתצוגה: עברית אם יש, אחרת אנגלית
export const displayName = (s) => s.teamHe || s.team;
export const subtitle = (s) =>
  [s.template !== 'plain' && typeHe(s.type) ? `${typeHe(s.type)} (${s.type})` : s.type, s.year].filter(Boolean).join(' · ');
