import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KITS } from '../data/kits';
import { buildPieces, DEFAULT_OPTIONS, DEFAULT_VOICE, PIECE_IDS, VOICE_RANGES } from './kit';
import { allSampleFiles, levelIndex, pickFile, pieceSample, SAMPLE_GROUPS } from './samples';

describe('מיפוי חלקים לדגימות', () => {
  it('כל חלק אפשרי ממופה לקבוצת דגימות קיימת ולכוונון חיובי', () => {
    for (const id of PIECE_IDS) {
      const s = pieceSample(id, {});
      expect(s, id).not.toBeNull();
      expect(SAMPLE_GROUPS[s.group], id).toBeTruthy();
      expect(s.rate, id).toBeGreaterThan(0.3);
      expect(s.rate, id).toBeLessThan(3);
      expect(s.decay, id).toBeGreaterThan(0);
    }
  });

  it('גם בקצוות של טווחי הקול הכול נשאר תקין', () => {
    for (const side of [0, 1]) {
      const voice = Object.fromEntries(Object.entries(VOICE_RANGES).map(([k, r]) => [k, r[side]]));
      for (const id of PIECE_IDS) {
        const s = pieceSample(id, voice);
        expect(s.rate, `${id} ${side}`).toBeGreaterThan(0.3);
        expect(Number.isFinite(s.decay)).toBe(true);
      }
    }
  });

  it('כל חלקי הסטים המפורסמים ושל הבונה ממופים', () => {
    const pieces = new Set(KITS.flatMap((k) => k.pieces));
    for (const id of buildPieces({ ...DEFAULT_OPTIONS, toms: 4, floors: 2, crashes: 2, china: true, splash: true, cowbell: true, doubleKick: true })) pieces.add(id);
    for (const id of pieces) expect(pieceSample(id, DEFAULT_VOICE), id).not.toBeNull();
  });

  it('כל ארבעת הטומים וטומי הרצפה בגבהים שונים', () => {
    const rates = ['tom1', 'tom2', 'tom3', 'tom4', 'floor1', 'floor2'].map((id) => {
      const s = pieceSample(id, {});
      return `${s.group}:${s.rate}`;
    });
    expect(new Set(rates).size).toBe(6);
  });

  it('חלק לא מוכר לא ממופה', () => {
    expect(pieceSample('nope', {})).toBeNull();
  });

  it('בחירת רמה וסבבים', () => {
    expect(levelIndex(3, 0)).toBe(0);
    expect(levelIndex(3, 1)).toBe(2);
    expect(levelIndex(3, 0.5)).toBe(1);
    expect(pickFile('kick', 1, 1)).not.toBe(pickFile('kick', 1, 2));
    expect(pickFile('nope', 1, 1)).toBeNull();
  });

  it('אין קבצים כפולים ובכל שם סיומת m4a', () => {
    const files = allSampleFiles();
    expect(new Set(files).size).toBe(files.length);
    expect(files.every((f) => f.endsWith('.m4a'))).toBe(true);
  });

  it('כל קובץ ברשימה קיים ב-public/samples', () => {
    for (const f of allSampleFiles()) expect(existsSync(new URL(`../../public/samples/${f}`, import.meta.url)), f).toBe(true);
  });
});
