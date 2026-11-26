// איך נראית הדמות של כל בוט במשרד התלת־ממדי – לפי התמונה שלו (public/avatars):
// גוון עור, שיער (סגנון וצבע), בגדים ואביזרים. בוט חדש בלי מראה מקבל מראה קבוע לפי המפתח.
export const LOOKS = {
  creative: { skin: '#c68a62', hair: 'curly', hairColor: '#7a3a1c', top: '#d9a441', jacket: null, pants: '#3b3f5c', extra: ['scarf'], female: true },
  campaigns: { skin: '#d8a47f', hair: 'short', hairColor: '#2a1d16', top: '#e7e2d6', jacket: '#26335c', pants: '#2c3245', extra: ['beard'] },
  editor: { skin: '#e0b08c', hair: 'messy', hairColor: '#16110f', top: '#1d1f26', jacket: null, pants: '#2b2f3d', extra: ['headphones'] },
  librarian: { skin: '#eac2a2', hair: 'bob', hairColor: '#b9b6b2', top: '#e8e0d0', jacket: '#c9ab84', pants: '#5b4a3c', extra: ['glasses'], female: true },
  social: { skin: '#dcaa86', hair: 'long', hairColor: '#21150f', top: '#1e1e24', jacket: '#5f84b5', pants: '#2b3550', extra: [], female: true },
  doctor: { skin: '#cf9e7d', hair: 'short', hairColor: '#8d8a86', top: '#9fc2e8', jacket: '#f4f6f8', pants: '#3a4257', extra: ['stethoscope', 'stubble'] },
  lawyer: { skin: '#e2b493', hair: 'short', hairColor: '#8f8b86', top: '#f2f2f2', jacket: '#1d2742', pants: '#1d2742', extra: ['beard', 'tie'] },
  coder: { skin: '#cf9c76', hair: 'curly', hairColor: '#17110d', top: '#4a4d55', jacket: null, pants: '#2a2d36', extra: ['beard', 'headphones'] },
  bursai: { skin: '#e3b593', hair: 'pixie', hairColor: '#131011', top: '#7fae8c', jacket: '#1f2028', pants: '#1f2028', extra: ['glasses'], female: true },
  travel: { skin: '#c99068', hair: 'short', hairColor: '#4a3020', top: '#a08a62', jacket: null, pants: '#6b5a44', extra: ['cap', 'stubble'] },
  manager: { skin: '#d9a37d', hair: 'straight', hairColor: '#120f10', top: '#f6f3ee', jacket: null, pants: '#22252f', extra: [], female: true },
};

const SKINS = ['#e6b896', '#d39b74', '#b97a54', '#8d5a3c'];
const HAIRS = [['short', '#2a1d16'], ['long', '#5a3a22'], ['bob', '#1b1512'], ['curly', '#3b2618']];
const TOPS = ['#5b7bd5', '#c0504d', '#4f9a7a', '#8e6bbf', '#d0913a'];

export function lookOf(key) {
  if (LOOKS[key]) return LOOKS[key];
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [hair, hairColor] = HAIRS[h % HAIRS.length];
  return { skin: SKINS[h % SKINS.length], hair, hairColor, top: TOPS[h % TOPS.length], jacket: null, pants: '#2b2f3d', extra: [], female: hair === 'long' || hair === 'bob' };
}
