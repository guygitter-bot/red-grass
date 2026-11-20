import { describe, expect, it } from 'vitest';
import { isPiece } from '../lib/kit';
import { KITS } from './kits';
import { CATEGORIES, EXERCISES, exerciseById } from './rudiments';

describe('תרגילי טכניקה', () => {
  it('יש מגוון תרגילים, מזהים ייחודיים וקטגוריות קיימות', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    const cats = CATEGORIES.map((c) => c.id);
    for (const e of EXERCISES) expect(cats, e.id).toContain(e.cat);
    expect(exerciseById('paradiddle').name).toBeTruthy();
    expect(exerciseById('nope')).toBeNull();
  });
  it('רשת, מקומות וקצבים תקינים', () => {
    for (const e of EXERCISES) {
      const s = e.section;
      expect([12, 16], e.id).toContain(s.steps);
      expect(s.bars).toBeGreaterThanOrEqual(1);
      expect(e.bpm).toBeGreaterThanOrEqual(40);
      expect(e.target).toBeGreaterThan(e.bpm);
      expect(e.target).toBeLessThanOrEqual(220);
      expect(e.desc).toBeTruthy();
      const n = s.steps * s.bars;
      let any = 0;
      for (const [p, idx] of Object.entries(s.hits)) {
        expect(isPiece(p), `${e.id}/${p}`).toBe(true);
        expect(idx.length, `${e.id}/${p}`).toBeGreaterThan(0);
        expect([...idx].sort((a, b) => a - b), `${e.id}/${p}`).toEqual(idx);
        for (const i of idx) expect(Number.isInteger(i) && i >= 0 && i < n).toBe(true);
        any += idx.length;
      }
      expect(any, e.id).toBeGreaterThan(3);
    }
  });
  it('הסטיקינג: לכל מכה ביד יש R או L, ולרגל אין; השקטים הם מכות ביד', () => {
    for (const e of EXERCISES) {
      const s = e.section;
      for (const [p, idx] of Object.entries(s.hits)) {
        const hands = s.hands[p] || {};
        const handed = Object.keys(hands).map(Number);
        for (const i of handed) expect(idx, `${e.id}/${p}`).toContain(i);
        for (const h of Object.values(hands)) expect(['R', 'L']).toContain(h);
        if (p === 'kick' || p === 'kick2') expect(handed, `${e.id}/${p}`).toHaveLength(0);
        else expect(handed.length, `${e.id}/${p}`).toBe(idx.length); // כל מכה בחלק ביד חייבת יד
      }
      for (const [p, idx] of Object.entries(s.soft)) for (const i of idx) expect(s.hands[p][i]).toBeTruthy();
    }
  });
  it('בתרגילי יד אחת-אחת אין שתי מכות ביד אחת באותו צעד', () => {
    for (const e of EXERCISES) {
      const s = e.section;
      const seen = new Set();
      for (const [p, hs] of Object.entries(s.hands)) {
        for (const [i, h] of Object.entries(hs)) {
          const k = `${i}:${h}`;
          expect(seen.has(k), `${e.id} ${p} ${k}`).toBe(false);
          seen.add(k);
        }
      }
    }
  });
  it('כל החלקים קיימים בסטים המפורסמים או שהם ניתנים להתאמה (סנר, היי-האט, בס, טומים)', () => {
    for (const e of EXERCISES) for (const p of Object.keys(e.section.hits)) {
      expect(KITS.some((k) => k.pieces.includes(p)), `${e.id}/${p}`).toBe(true);
    }
  });
});
