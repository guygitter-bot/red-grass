import { describe, expect, it } from 'vitest';
import { KITS } from '../data/kits';
import { applyChars, buildPieces, DEFAULT_OPTIONS, isPiece, optionsFromPieces, pieceForCode, PIECES, REQUIRED, safeKit, safeOptions, safeVoice, VOICE_RANGES } from './kit';

describe('סטים מפורסמים', () => {
  it('לכל סט יש בס, סנר והיי-האט', () => {
    for (const k of KITS) for (const r of REQUIRED) expect(k.pieces, k.id).toContain(r);
  });
  it('מזהים ייחודיים, חלקים מוכרים וללא כפילות', () => {
    expect(new Set(KITS.map((k) => k.id)).size).toBe(KITS.length);
    for (const k of KITS) {
      expect(new Set(k.pieces).size, k.id).toBe(k.pieces.length);
      for (const p of k.pieces) expect(isPiece(p), `${k.id}:${p}`).toBe(true);
      expect(k.name && k.desc).toBeTruthy();
    }
  });
  it('הקול בטווח המותר', () => {
    for (const k of KITS) {
      const v = safeVoice(k.voice);
      for (const key of Object.keys(k.voice)) expect(v[key], `${k.id}:${key}`).toBe(k.voice[key]);
      for (const [key, [lo, hi]] of Object.entries(VOICE_RANGES)) expect(v[key]).toBeGreaterThanOrEqual(lo), expect(v[key]).toBeLessThanOrEqual(hi);
    }
  });
  it('לכל חלק מקש ייחודי', () => {
    const codes = Object.values(PIECES).map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('safeKit', () => {
  it('ברירות מחדל לנתונים ריקים או שבורים', () => {
    for (const bad of [undefined, null, 5, 'x', {}, { options: 'bad', baseVoice: [] }]) {
      const k = safeKit(bad);
      expect(k.name).toBe('הסט שלי');
      expect(k.options).toEqual(DEFAULT_OPTIONS);
      expect(k.id).toBeTruthy();
      for (const r of REQUIRED) expect(k.pieces).toContain(r);
      expect(k.voice.kickTune).toBe(1);
    }
  });
  it('שומר שדות תקינים ומתעלם ממה שלא', () => {
    const k = safeKit({ id: 'a', name: '  רוק  ', options: { toms: 9, floors: -3, doubleKick: true, kickChar: 'nope' }, baseVoice: { kickTune: 99 } });
    expect(k.id).toBe('a');
    expect(k.name).toBe('רוק');
    expect(k.options.toms).toBe(4);
    expect(k.options.floors).toBe(0);
    expect(k.options.kickChar).toBe('keep');
    expect(k.pieces).toContain('kick2');
    expect(k.baseVoice.kickTune).toBe(1.5);
  });
});

describe('buildPieces', () => {
  it('הסט הבסיסי', () => {
    expect(buildPieces(DEFAULT_OPTIONS)).toEqual(['kick', 'snare', 'hihat', 'hihatOpen', 'tom1', 'tom2', 'floor1', 'crash1', 'ride']);
  });
  it('סט מלא', () => {
    const p = buildPieces({ toms: 4, floors: 2, crashes: 2, ride: true, china: true, splash: true, cowbell: true, doubleKick: true });
    expect(p).toHaveLength(17);
    expect(p[1]).toBe('kick2');
  });
  it('סט מינימלי עדיין שלם', () => {
    const p = buildPieces({ toms: 0, floors: 0, crashes: 0, ride: false });
    expect(p).toEqual(['kick', 'snare', 'hihat', 'hihatOpen']);
  });
  it('אפשרויות ← חלקים ← אפשרויות', () => {
    for (const k of KITS) {
      const o = optionsFromPieces(k.pieces);
      expect([...buildPieces(o)].sort(), k.id).toEqual([...k.pieces].sort());
    }
  });
});

describe('אופי הצליל', () => {
  it('keep משאיר את הקול, אחר מחליף רק את הבס והסנר', () => {
    const base = safeVoice({ tomTune: 0.8, kickTune: 1.1 });
    expect(applyChars(base, { kickChar: 'keep', snareChar: 'keep' })).toEqual(base);
    const v = applyChars(base, { kickChar: 'deep', snareChar: 'tight' });
    expect(v.kickTune).toBe(0.75);
    expect(v.snareTune).toBe(1.25);
    expect(v.tomTune).toBe(0.8);
  });
  it('מקש ← חלק רק מתוך הסט', () => {
    expect(pieceForCode(['kick', 'snare'], 'Space')).toBe('kick');
    expect(pieceForCode(['kick', 'snare'], 'KeyU')).toBe(null);
  });
  it('safeOptions מגביל', () => {
    expect(safeOptions({ toms: 2.6 }).toms).toBe(3);
  });
});
