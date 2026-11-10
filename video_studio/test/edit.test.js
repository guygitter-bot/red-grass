// בדיקות לפעולות העריכה הטהורות
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../server/edit.js';

const media = { id: 'm1', kind: 'video', duration: 20, width: 1920, height: 1080, hasAudio: true };
function project() {
  const p = E.emptyProject();
  p.media.push(media);
  E.addMediaClip(p, media);
  return p;
}

test('הסרטון הראשון קובע את כיוון הפרויקט', () => {
  const p = project();
  assert.deepEqual([p.settings.width, p.settings.height], [1920, 1080]);
  assert.equal(p.clips[0].duration, 20);
});

test('פיצול שומר על המקור ועל המשך', () => {
  const p = project();
  E.splitAt(p, 5);
  const [a, b] = E.trackClips(p, 'V1');
  assert.deepEqual([a.start, a.duration, a.offset], [0, 5, 0]);
  assert.deepEqual([b.start, b.duration, b.offset], [5, 15, 5]);
});

test('מחיקת קטע סוגרת את הרווח', () => {
  const p = project();
  E.splitAt(p, 5); E.splitAt(p, 8);
  const mid = E.trackClips(p, 'V1')[1];
  E.deleteClips(p, [mid.id], true);
  const cs = E.trackClips(p, 'V1');
  assert.equal(cs.length, 2);
  assert.deepEqual([cs[1].start, cs[1].offset], [5, 8]);
  assert.equal(E.totalDuration(p), 17);
});

test('מחיקת טווח מכל השכבות עם סגירת רווח', () => {
  const p = project();
  E.addTextClip(p, { text: 'a', start: 9, duration: 4 });
  E.deleteRange(p, 4, 10);
  const [a, b] = E.trackClips(p, 'V1');
  assert.deepEqual([a.start, a.duration], [0, 4]);
  assert.deepEqual([b.start, b.duration, b.offset], [4, 10, 10]);
  const txt = p.clips.find((c) => c.type === 'text');
  assert.deepEqual([txt.start, txt.duration], [4, 3]);
  assert.equal(E.totalDuration(p), 14);
});

test('קטע לא נכנס על קטע אחר באותה שכבה', () => {
  const p = project();
  const c2 = E.addMediaClip(p, media, { start: 3 });
  assert.equal(c2.start, 20);
  assert.throws(() => E.moveClip(p, c2.id, { trackId: 'A1' }));
});

test('קיצוץ לא חורג מאורך הקובץ', () => {
  const p = project();
  const c = E.updateClip(p, p.clips[0].id, { offset: 15, duration: 30 });
  assert.deepEqual([c.offset, c.duration], [15, 5]);
});

test('שתיקות: רק איפה שאף קטע לא משמיע קול, עם שוליים', () => {
  const p = project();
  const r = E.timelineSilences(p, p.clips, { m1: [[2, 4], [10, 10.3]] }, { minDuration: 0.5, padding: 0.1 });
  assert.deepEqual(r, [[2.1, 3.9]]);
  E.deleteRanges(p, r);
  assert.equal(E.totalDuration(p), 18.2);
});

test('מילים הופכות לכתוביות קצרות, ופיצול כתובית מחלק את המילים', () => {
  const words = 'אחת שתיים שלוש ארבע חמש שש שבע'.split(' ').map((w, i) => ({ w, s: i * 0.5, e: i * 0.5 + 0.4 }));
  const caps = E.wordsToCaptions(words, { maxChars: 14 });
  assert.ok(caps.length >= 3);
  assert.ok(caps.every((c) => c.text.length <= 16));
  const p = project();
  E.setCaptions(p, caps);
  const first = p.clips.find((c) => c.type === 'caption');
  assert.equal(first.words[0].s, 0);
  E.splitAt(p, first.start + first.words[1].s - 0.01, [first.id]);
  assert.equal(p.clips.find((c) => c.id === first.id).words.length, 1);
});

test('SRT הלוך ושוב', () => {
  const caps = E.parseSrt('1\n00:00:01,000 --> 00:00:02,500\nשלום עולם\n\n2\n00:00:03,000 --> 00:00:04,000\nHello\n');
  assert.deepEqual(caps.map((c) => [c.start, c.duration, c.text]), [[1, 1.5, 'שלום עולם'], [3, 1, 'Hello']]);
  const p = project();
  E.setCaptions(p, caps);
  assert.match(E.toSrt(p), /00:00:01,000 --> 00:00:02,500\nשלום עולם/);
});
