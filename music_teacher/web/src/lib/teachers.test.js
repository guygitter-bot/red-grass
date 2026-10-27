import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TEACHERS, DEFAULT_TEACHER, teacherById } from './teachers.js';
import { getTeacher, setTeacher } from './storage.js';

// localStorage מדומה (הבדיקות רצות ב-node)
function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

describe('בחירת המורה', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  it('ברירת מחדל: גבר', () => {
    expect(DEFAULT_TEACHER).toBe('male');
    expect(getTeacher()).toBe('male');
  });
  it('ערך לא מוכר או שבור -> גבר', () => {
    for (const raw of ['"robot"', '7', 'לא json', 'null', '{"a":1}']) {
      vi.stubGlobal('localStorage', fakeStorage({ mt_teacher: raw }));
      expect(getTeacher(), raw).toBe('male');
    }
  });
  it('שמירה וקריאה', () => {
    setTeacher('male');
    expect(localStorage.getItem('mt_teacher')).toBe('"male"');
    expect(getTeacher()).toBe('male');
  });
  it('מורה "בקרוב" לא נשמר ולא נבחר', () => {
    const soon = TEACHERS.find((t) => t.comingSoon);
    if (!soon) return;
    setTeacher(soon.id);
    expect(localStorage.getItem('mt_teacher')).toBeNull();
    vi.stubGlobal('localStorage', fakeStorage({ mt_teacher: JSON.stringify(soon.id) }));
    expect(getTeacher()).toBe('male');
    expect(teacherById(soon.id).id).toBe('male');
  });
  it('בלי localStorage בכלל (מצב פרטי) לא קורס', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(getTeacher()).toBe('male');
    expect(() => setTeacher('male')).not.toThrow();
  });
});

describe('רשימת המורים', () => {
  const pub = path.resolve(__dirname, '../../public');
  it('מזהים ייחודיים ויש מורה ברירת מחדל מוכן', () => {
    expect(new Set(TEACHERS.map((t) => t.id)).size).toBe(TEACHERS.length);
    const d = TEACHERS.find((t) => t.id === DEFAULT_TEACHER);
    expect(d && !d.comingSoon).toBe(true);
  });
  it.each(TEACHERS.filter((t) => !t.comingSoon).map((t) => [t.id, t.file]))('הקובץ של %s קיים ב-public (%s)', (_id, file) => {
    const p = path.join(pub, file);
    expect(fs.existsSync(p), p).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(3 * 1024 * 1024);
  });
  it.each(TEACHERS.filter((t) => !t.comingSoon).map((t) => [t.id, t.file]))('%s: GLB עם דמות עם שלד ואצבעות', (_id, file) => {
    const buf = fs.readFileSync(path.join(pub, file));
    expect(buf.readUInt32LE(0)).toBe(0x46546c67); // "glTF"
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    expect(json.skins && json.skins.length).toBeGreaterThan(0);
    const names = new Set(json.nodes.map((n) => n.name));
    for (const side of ['Left', 'Right']) {
      for (const b of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot']) expect(names.has(`mixamorig${side}${b}`), `${side}${b}`).toBe(true);
      for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (const j of [1, 2, 3, 4]) expect(names.has(`mixamorig${side}Hand${f}${j}`), `${side}${f}${j}`).toBe(true);
    }
    for (const b of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) expect(names.has(`mixamorig${b}`), b).toBe(true);
  });
  it('מורה לא מוכר -> ברירת מחדל', () => {
    expect(teacherById('nope').id).toBe('male');
    expect(teacherById(undefined).id).toBe('male');
  });
});
