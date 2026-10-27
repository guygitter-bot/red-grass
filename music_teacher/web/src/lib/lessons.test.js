import { describe, it, expect } from 'vitest';
import { LESSON1, LESSON2, LESSON_LIST, pick, AM_CHORD, CHORDS } from './lessons.js';
import { validateChord } from './chord.js';
import { PRESETS, PART_NAMES } from './parts.js';
import { STRINGS, STRING_ORDER, fretFreq } from './notes.js';
import { createGuitar } from '../three/guitar.js';
import { createTeacher } from '../three/teacher.js';

const TYPES = ['classical', 'electric'];

describe('נתוני מיתרים', () => {
  it('כוונון סטנדרטי E A D G B E', () => {
    expect(STRING_ORDER.map((n) => STRINGS[n].note).join('')).toBe('EADGBE');
  });
  it('שריג 12 הוא אוקטבה', () => {
    for (const n of STRING_ORDER) expect(fretFreq(n, 12)).toBeCloseTo(STRINGS[n].freq * 2);
  });
});

describe('שלמות השיעורים', () => {
  it.each(TYPES)('כל שלב מפנה למצלמה ולחלקים קיימים (%s)', (type) => {
    for (const lesson of [LESSON1, LESSON2]) {
      for (const s of lesson) {
        expect(PRESETS[type][s.camera], `${s.id}: מצלמה ${s.camera}`).toBeTruthy();
        for (const p of pick(s.parts, type)) expect(PART_NAMES[type][p], `${s.id}: חלק ${p}`).toBeTruthy();
        for (const l of pick(s.labels, type)) expect(PART_NAMES[type][l.part], `${s.id}: תווית ${l.part}`).toBeTruthy();
        expect(pick(s.say, type).length).toBeGreaterThan(20);
        expect(pick(s.title, type).length).toBeGreaterThan(1);
      }
    }
  });
  it('כל מצלמה מפנה לחלק קיים', () => {
    for (const type of TYPES) {
      for (const [name, p] of Object.entries(PRESETS[type])) {
        if (p.part) expect(PART_NAMES[type][p.part], `${type}/${name}`).toBeTruthy();
      }
    }
  });
  it('שיעור 1 הוא 9 שלבים, מזהים ייחודיים', () => {
    expect(LESSON1).toHaveLength(9);
    expect(new Set(LESSON1.map((s) => s.id)).size).toBe(9);
  });
  it('רשימת השיעורים: 1 ו-2 פתוחים, השאר בקרוב', () => {
    expect(LESSON_LIST.filter((l) => l.open).map((l) => l.id)).toEqual([1, 2]);
  });
  it('אקורד Am', () => {
    expect(AM_CHORD.fingers.map((f) => [f.finger, f.string, f.fret])).toEqual([[1, 2, 1], [2, 4, 2], [3, 3, 2]]);
  });
});

describe('דגמי התלת־ממד (בלי דפדפן)', () => {
  it.each(TYPES)('הגיטרה (%s) כוללת את כל החלקים ושישה מיתרים', (type) => {
    const g = createGuitar(type);
    for (const p of Object.keys(PART_NAMES[type])) {
      expect(g.parts[p], `חסר חלק ${p}`).toBeTruthy();
      expect(g.parts[p].meshes.length).toBeGreaterThan(0);
      expect(g.parts[p].center).toBeTruthy();
    }
    expect(Object.keys(g.strings)).toHaveLength(6);
    expect(g.hitMeshes).toHaveLength(6);
    g.dispose();
  });
  it.each(TYPES)('המורה (%s) נבנה ומתעדכן בלי שגיאות', (type) => {
    const g = createGuitar(type);
    const t = createTeacher(g);
    t.setLeftHand({ fingers: [{ finger: 1, string: 2, fret: 1 }, { finger: 2, string: 4, fret: 2 }, { finger: 3, string: 3, fret: 2 }] });
    for (let i = 0; i < 20; i++) t.update(0.016, i * 0.016);
    t.pluck(3);
    t.strum('d', [5, 4, 3, 2, 1]);
    t.wave(1);
    for (let i = 0; i < 20; i++) t.update(0.016, 1 + i * 0.016);
    t.dispose();
    g.dispose();
  });
});

describe('אקורדים בשיעורים', () => {
  it('כל אקורד תקין, וכל שלב עם יד שמאל מצביע על אקורד קיים', () => {
    Object.entries(CHORDS).forEach(([k, c]) => {
      expect(c.name, k).toBe(k);
      expect(validateChord(c), k).toEqual([]);
    });
    LESSON2.filter((s) => s.leftHand).forEach((s) => expect(CHORDS[s.leftHand], s.id).toBeTruthy());
  });
  it('שלב האצבעות משתמש במצלמת התקריב של האקורד', () => {
    const s = LESSON2.find((x) => x.tool === 'chord');
    expect(s.camera).toBe('chord');
    expect(PRESETS.classical.chord.board).toBe(true);
    expect(PRESETS.electric.chord.board).toBe(true);
  });
});
