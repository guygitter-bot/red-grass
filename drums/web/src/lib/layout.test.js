import { describe, expect, it } from 'vitest';
import { KITS } from '../data/kits';
import { PIECE_IDS, buildPieces } from './kit';
import { layoutFor, STAGE_HEIGHT } from './layout';

// בודק שאין חלקים שחופפים ושכולם בתוך הבמה
function problems(pieces, mode) {
  const pads = layoutFor(pieces, mode);
  const H = STAGE_HEIGHT[mode];
  const out = [];
  for (const p of pads) {
    const r = p.s / 2;
    if (p.x - r < 0 || p.x + r > 100 || p.y - r < 0 || p.y + r > H) out.push(`${p.id} יוצא מהבמה`);
  }
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i];
      const b = pads[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.s + b.s) / 2 - 0.2) out.push(`${a.id} חופף ל-${b.id}`);
    }
  }
  return out;
}

describe('פריסת הבמה', () => {
  for (const mode of ['wide', 'tall']) {
    it(`כל החלקים (${mode})`, () => {
      const all = PIECE_IDS.filter((id) => id !== 'kick2');
      expect(problems(all, mode)).toEqual([]);
      expect(problems(PIECE_IDS, mode)).toEqual([]);
    });
    it(`כל הסטים המפורסמים (${mode})`, () => {
      for (const k of KITS) expect(problems(k.pieces, mode), k.id).toEqual([]);
    });
    it(`כל צירופי הבונה (${mode})`, () => {
      for (let t = 0; t <= 4; t++) for (let f = 0; f <= 2; f++) for (const dk of [false, true]) {
        const pieces = buildPieces({ toms: t, floors: f, crashes: 2, ride: true, china: true, splash: true, cowbell: true, doubleKick: dk });
        expect(problems(pieces, mode), `${t}/${f}/${dk}`).toEqual([]);
      }
    });
    it(`לכל חלק יש מקום (${mode})`, () => {
      expect(layoutFor(PIECE_IDS, mode)).toHaveLength(PIECE_IDS.length);
    });
  }
});
