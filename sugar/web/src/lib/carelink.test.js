import { describe, expect, test } from 'vitest';
import { cgmRecords, parseDate, readCarelink, splitLine } from './carelink';
import { cgmAt, outcome, prepare, stats, allPoints, manualPoints } from './diary';

// קובץ מומצא במבנה של CareLink (לא נתונים אמיתיים)
const HEAD = 'Index,Date,Time,New Device Time,BG Reading (mg/dL),Linked BG Meter ID,Bolus Volume Delivered (U),Sensor Glucose (mg/dL),ISIG Value,Sensor State';
const SAMPLE = [
  '﻿Last Name,First Name,Patient ID,System ID,Start Date,End Date,Device,Simplera™ system',
  '"ישראלי","ילד","","","01/11/26 00:00:00","02/11/26 00:00:00","Serial Number",XXXX',
  'Patient DOB,',
  '',
  '-------,Simplera™ system,Pump,XXXX,------- ',
  HEAD,
  '0.00000,2026/11/02,20:09:46,,,,,,,NORMAL',
  '-------,Simplera™ system,Sensor,XXXX,------- ',
  HEAD,
  '0.00000,2026/11/02,15:00:00,,,,,180,,',
  '1.00000,2026/11/02,14:00:00,,,,,240,,',
  '2.00000,2026/11/02,13:05:00,,,,,120,,',
  '3.00000,2026/11/02,13:00:00,,95,,,118,,',
  '4.00000,2026/11/01,23:55:00,,,,,65,,',
].join('\r\n');

describe('ייבוא מ-CareLink', () => {
  test('קריאת שורות ותאריכים', () => {
    expect(splitLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
    expect(parseDate('2026/11/04')).toBe('2026-11-04');
    expect(parseDate('04/11/26')).toBe('2026-11-04');
    expect(parseDate('4.11.2026')).toBe('2026-11-04');
  });

  test('מדידות החיישן לפי יום, ומדידת אצבע', () => {
    const r = readCarelink(SAMPLE);
    expect(r.count).toBe(5);
    expect(r.from).toBe('2026-11-01');
    expect(r.to).toBe('2026-11-02');
    expect(r.days.get('2026-11-02')).toEqual([[780, 118], [785, 120], [840, 240], [900, 180]]);
    expect(r.bg).toEqual([{ date: '2026-11-02', time: '13:00', value: 95 }]);
  });

  test('נקודה-פסיק כמפריד', () => {
    const r = readCarelink(['Index;Date;Time;Sensor Glucose (mg/dL)', '1;04.11.2026;08:00:00;101'].join('\n'));
    expect(r.days.get('2026-11-04')).toEqual([[480, 101]]);
  });

  test('קובץ אחר – שגיאה ברורה', () => {
    expect(() => readCarelink('hello,world')).toThrow(/CareLink/);
  });

  test('ייבוא חוזר מתמזג ולא מכפיל', () => {
    const r = readCarelink(SAMPLE);
    const recs = cgmRecords(r, new Map([['2026-11-02', [[600, 100], [780, 999]]]]));
    const day = recs.find((x) => x.date === '2026-11-02');
    expect(day.id).toBe('cgm:2026-11-02');
    expect(day.points).toEqual([[600, 100], [780, 118], [785, 120], [840, 240], [900, 180]]);
  });

  test('החיישן משלים את הארוחה: לפני, שעתיים אחרי ושיא', () => {
    const recs = cgmRecords(readCarelink(SAMPLE));
    const data = prepare([...recs, { id: 'm', t: 'meal', date: '2026-11-02', time: '13:00', name: 'צהריים', insulin: 3 }, { id: 'r', t: 'reading', date: '2026-11-02', time: '10:00', value: 300 }]);
    expect(cgmAt(data, '2026-11-02', 783)).toBe(120);
    const o = outcome(data.meals[0], data);
    expect(o.before).toBe(118);
    expect(o.beforeCgm).toBe(true);
    expect(o.after2h).toBe(180);
    expect(o.peak).toBe(240);
    expect(o.after.every((x) => x.cgm)).toBe(true);
    // בלי נתוני חיישן – כמו קודם
    expect(outcome(data.meals[0]).after).toEqual([]);
    // ביום עם חיישן – הסטטיסטיקה מהחיישן (המדידה הידנית 300 לא נספרת), אבל בגרף היא מופיעה
    expect(allPoints(data, '2026-11-02', '2026-11-02').map((p) => p.value)).toEqual([118, 120, 240, 180]);
    expect(manualPoints(data, '2026-11-02', '2026-11-02')).toHaveLength(1);
    expect(stats(data, 2, '2026-11-02').count).toBe(5);
  });
});
