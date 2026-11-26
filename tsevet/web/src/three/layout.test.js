import { describe, expect, it } from 'vitest';
import { floorPlan, pathBetween, pathLength, pointAt, seat, visitorSpot, windowSpot, HALL } from './layout';
import { LOOKS, lookOf } from './looks';

const KEYS = ['creative', 'campaigns', 'editor', 'librarian', 'social', 'doctor', 'lawyer', 'coder', 'bursai', 'travel', 'manager'];

const inside = (room, p) => Math.abs(p.x - room.x) < room.w / 2 && Math.abs(p.z - room.z) < room.d / 2;

describe('המשרד התלת־ממדי – מפת הקומה', () => {
  it('משרד לכל בוט, המנהל בסוף המסדרון, בלי חפיפות', () => {
    const plan = floorPlan(KEYS);
    expect(plan.rooms.map((r) => r.key).sort()).toEqual([...KEYS].sort());
    const m = plan.rooms.find((r) => r.key === 'manager');
    expect(m.big).toBe(true);
    expect(Math.min(...plan.rooms.map((r) => r.z))).toBe(m.z);
    for (const a of plan.rooms) {
      for (const b of plan.rooms) {
        if (a === b) continue;
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01;
        expect(overlap, `${a.key}/${b.key}`).toBe(false);
      }
      // לא נכנס למסדרון
      if (a.side) expect(Math.abs(a.x) - a.w / 2).toBeGreaterThanOrEqual(HALL / 2 - 0.01);
    }
  });

  it('הכיסא, מקום האורח והחלון – בתוך המשרד', () => {
    for (const room of floorPlan(KEYS).rooms) {
      expect(inside(room, seat(room))).toBe(true);
      expect(inside(room, visitorSpot(room))).toBe(true);
      expect(inside(room, windowSpot(room))).toBe(true);
    }
  });

  it('מסלול בין משרדים עובר במסדרון ומגיע ליעד', () => {
    const plan = floorPlan(KEYS);
    const a = plan.rooms.find((r) => r.key === 'creative');
    const b = plan.rooms.find((r) => r.key === 'manager');
    const pts = pathBetween(a, b, seat(a), visitorSpot(b));
    expect(pts.some((p) => Math.abs(p.x) < HALL / 2)).toBe(true);
    const len = pathLength(pts);
    expect(pointAt(pts, 0)).toMatchObject({ x: pts[0].x, z: pts[0].z });
    const end = pointAt(pts, len + 1);
    expect(end.done).toBe(true);
    expect(end.x).toBeCloseTo(visitorSpot(b).x);
    // בתוך אותו משרד – ישר, בלי לצאת
    expect(pathBetween(a, a, seat(a), windowSpot(a))).toHaveLength(2);
  });

  it('בלי מנהל ועם מספר בוטים אי־זוגי', () => {
    const plan = floorPlan(['a', 'b', 'c']);
    expect(plan.rooms).toHaveLength(3);
    expect(plan.rooms.every((r) => !r.big)).toBe(true);
  });
});

describe('מראה הדמויות', () => {
  it('לכל בוט עם תמונה יש מראה, ולבוט חדש מראה קבוע', () => {
    for (const k of KEYS) expect(LOOKS[k], k).toBeTruthy();
    expect(lookOf('newbot')).toEqual(lookOf('newbot'));
    expect(lookOf('newbot').skin).toMatch(/^#/);
  });
});
