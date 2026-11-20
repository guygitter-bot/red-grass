// גימור (עטיפה) של התופים לכל סט – רק מראה: משפיע על המעטפות בבמה (תלת־ממד וגם הבמה השטוחה) ועל כרטיסי הסטים.
// סט אישי יורש את הגימור של הסט שממנו נבנה. הצבעים לבמה השטוחה ב-index.css (`[data-finish='…']`) – אותם גוונים כמו כאן.
const FINISH = {
  standard: 'midnight',
  bonham: 'emerald',
  ringo: 'pearl',
  peart: 'ruby',
  barker: 'chrome',
  grohl: 'teal',
  porcaro: 'ivory',
  chadsmith: 'violet',
  ulrich: 'piano',
};

// a, b = שני גוונים של העטיפה, sp = כמות נצנצים (0 = לכה חלקה), kind = סוג העטיפה בתלת־ממד
export const FINISH_COLORS = {
  midnight: { a: '#1d2a86', b: '#7d93ff', sp: 0.85, kind: 'sparkle', name: 'נצנצים כחול חצות' },
  emerald: { a: '#0a5a39', b: '#48e29a', sp: 0.85, kind: 'sparkle', name: 'נצנצים ירוק אמרלד' },
  pearl: { a: '#18161f', b: '#6b6880', sp: 0.45, kind: 'pearl', name: 'שחור פנינה' },
  ruby: { a: '#7a0a24', b: '#ff4f74', sp: 0.85, kind: 'sparkle', name: 'נצנצים אדום רובי' },
  chrome: { a: '#8e95ad', b: '#f2f4fb', sp: 0.3, kind: 'chrome', name: 'כרום' },
  teal: { a: '#085a63', b: '#3fe0e6', sp: 0.85, kind: 'sparkle', name: 'נצנצים טורקיז' },
  ivory: { a: '#d6ccb2', b: '#fbf6e6', sp: 0.2, kind: 'lacquer', name: 'לכה שנהב' },
  violet: { a: '#3c1690', b: '#b892ff', sp: 0.85, kind: 'sparkle', name: 'נצנצים סגול' },
  piano: { a: '#07060c', b: '#3a3850', sp: 0, kind: 'lacquer', name: 'שחור פסנתר' },
};

export function finishOf(kit) {
  const id = kit && (kit.custom ? kit.baseId : kit.id);
  return FINISH[id] || 'midnight';
}
