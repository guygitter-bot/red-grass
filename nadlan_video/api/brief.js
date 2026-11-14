// הבריף של הסרטון: מה מצלמים, באיזה אור, באיזה פורמט. המזהים כפולים ב-web/src/lib/brief.js – לשנות בשניהם (בדיקה מוודאת).
export const KINDS = {
  building: 'a residential building / real-estate project (exterior)',
  apartment: 'an apartment (interior)',
  house: 'a private house / villa',
};

// האור והאווירה של כל הסרטון (אחיד בכל השוטים)
export const LOOKS = {
  golden: 'golden hour: warm low sun, long soft shadows, glowing glass reflections, clear sky with a few thin clouds',
  day: 'bright clear Mediterranean day: crisp blue sky, clean neutral daylight, fresh green landscaping',
  dusk: 'blue-hour dusk: deep blue sky, warm interior lights glowing from the windows, lit landscaping and entrance',
};

export const ASPECTS = ['16:9', '9:16'];
export const QUALITIES = ['max', 'fast'];
export const SHOTS = 4;

const str = (s, max) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = (v, all, def) => (all.includes(v) ? v : def);

// ניקוי הבריף מהלקוח, עם ברירות מחדל
export function cleanBrief(b) {
  return {
    kind: pick(b?.kind, Object.keys(KINDS), 'building'),
    look: pick(b?.look, Object.keys(LOOKS), 'golden'),
    aspect: pick(b?.aspect, ASPECTS, '16:9'),
    name: str(b?.name, 80),
    note: str(b?.note, 600),
  };
}
