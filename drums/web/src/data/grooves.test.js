import { describe, expect, it } from 'vitest';
import { GROOVES, grooveFor } from './grooves';
import { KITS } from './kits';
import { KIT_SONGS } from './songs';

describe('ביטים לכל שיר', () => {
  it('לכל שיר יש ביט, ואין ביט לשיר שלא קיים', () => {
    const ids = Object.values(KIT_SONGS).flat().map((s) => s.youtubeId);
    expect(ids).toHaveLength(40);
    for (const id of ids) expect(grooveFor(id), id).toBeTruthy();
    expect(Object.keys(GROOVES).sort()).toEqual([...ids].sort());
  });
  it('קצב, צעדים ומקומות תקינים', () => {
    for (const [id, gr] of Object.entries(GROOVES)) {
      expect(gr.bpm, id).toBeGreaterThanOrEqual(40);
      expect(gr.bpm, id).toBeLessThanOrEqual(220);
      expect(gr.tip, id).toBeTruthy();
      expect(gr.sections.length, id).toBeGreaterThanOrEqual(1);
      expect(gr.sections.length, id).toBeLessThanOrEqual(3);
      for (const s of gr.sections) {
        expect([12, 16], id).toContain(s.steps);
        expect([1, 2], id).toContain(s.bars);
        expect(s.name).toBeTruthy();
        const n = s.steps * s.bars;
        let any = 0;
        for (const idx of Object.values(s.hits)) {
          for (const i of idx) {
            expect(Number.isInteger(i) && i >= 0 && i < n, `${id}/${s.id}`).toBe(true);
          }
          any += idx.length;
        }
        expect(any, `${id}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });
  it('כל חלק בביט קיים בסט של הלהקה', () => {
    for (const [kitId, songs] of Object.entries(KIT_SONGS)) {
      const kit = KITS.find((k) => k.id === kitId);
      for (const s of songs) {
        for (const sec of GROOVES[s.youtubeId].sections) {
          for (const p of Object.keys(sec.hits)) expect(kit.pieces, `${s.title}/${sec.id}/${p}`).toContain(p);
        }
      }
    }
  });
  it('מזהי הסעיפים ייחודיים בכל שיר', () => {
    for (const gr of Object.values(GROOVES)) {
      const ids = gr.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
