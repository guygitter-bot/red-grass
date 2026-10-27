// מיתרי הגיטרה בכוונון סטנדרטי: מיתר 6 הנמוך והעבה, מיתר 1 הגבוה והדק
export const STRINGS = {
  6: { n: 6, note: 'E', oct: 2, freq: 82.41, name: 'E נמוך', he: 'מי נמוך', thick: 'העבה ביותר' },
  5: { n: 5, note: 'A', oct: 2, freq: 110.0, name: 'A', he: 'לה', thick: '' },
  4: { n: 4, note: 'D', oct: 3, freq: 146.83, name: 'D', he: 'רה', thick: '' },
  3: { n: 3, note: 'G', oct: 3, freq: 196.0, name: 'G', he: 'סול', thick: '' },
  2: { n: 2, note: 'B', oct: 3, freq: 246.94, name: 'B', he: 'סי', thick: '' },
  1: { n: 1, note: 'E', oct: 4, freq: 329.63, name: 'E גבוה', he: 'מי גבוה', thick: 'הדק ביותר' },
};
export const STRING_ORDER = [6, 5, 4, 3, 2, 1];

// שמות התווים בעברית (ללא דיאז/במול)
const HE = { C: 'דו', D: 'רה', E: 'מי', F: 'פה', G: 'סול', A: 'לה', B: 'סי' };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function heNote(name) {
  const base = HE[name[0]] || name;
  return name.includes('#') ? base + ' דיאז' : base;
}

export function stringLabel(n) {
  const s = STRINGS[n];
  return `מיתר ${n} · ${s.name} (${s.he})`;
}

// תדר של מיתר לחוץ בשריג מסוים
export function fretFreq(string, fret = 0) {
  return STRINGS[string].freq * Math.pow(2, fret / 12);
}
