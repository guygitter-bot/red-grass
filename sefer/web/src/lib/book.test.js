import { describe, it, expect } from 'vitest';
import { safeBook, makeBook, nextStep, progress, imageKeys, coverKey, toShared, toView, pagesOf, paragraphs, tail, outlineOf } from './book.js';
import { questionsFor, answered, briefProblem, defaultsFor, emptyBrief } from './brief.js';
import { fitSize } from './image.js';

const BRIEF = { ...emptyBrief(), occasion: 'birthday', name: 'דנה', gender: 'f', from: 'יואב', answers: [{ q: 'א', a: 'ב' }, { q: 'ג', a: 'ד' }] };
const OUTLINE = { title: 'דנה והקפה', subtitle: 'סיפור', dedication: 'לדנה', look: 'a woman', cover: 'a cup', chapters: [{ title: 'בוקר', summary: 'קפה' }, { title: 'ערב', summary: 'טיול' }] };

describe('ספר', () => {
  it('ספר ישן בלי שדות חדשים ממשיך לעבוד', () => {
    const b = safeBook({ id: '1', chapters: [{ title: 'א' }] });
    expect(b.chapters[0]).toMatchObject({ title: 'א', text: '', hasImage: false });
    expect(b.brief.answers).toEqual([]);
    expect(b.share).toBe(null);
    expect(safeBook({}).chapters).toEqual([]);
  });

  it('ספר חדש מהמתווה: הקדשה של המשתמש קודמת, כריכה מתמונה רק אם הועלתה תמונה', () => {
    const b = makeBook({ ...BRIEF, dedication: 'שלי' }, OUTLINE, { coverKind: 'photo', usePhoto: true });
    expect(b.dedication).toBe('שלי');
    expect(b.coverKind).toBe('art');
    expect(b.usePhoto).toBe(false);
    expect(makeBook(BRIEF, OUTLINE, { photos: 2, coverKind: 'photo' }).coverKind).toBe('photo');
    expect(b.chapters.map((c) => c.title)).toEqual(['בוקר', 'ערב']);
    expect(new Set(b.chapters.map((c) => c.id)).size).toBe(2);
  });

  it('הצעד הבא: כריכה, ואחרי אישור המתווה פרק ואז האיור שלו', () => {
    let b = makeBook(BRIEF, OUTLINE);
    expect(nextStep(b)).toEqual({ kind: 'cover' });
    b = { ...b, hasCover: true };
    expect(nextStep(b)).toBe(null); // מחכים לאישור המתווה
    b = { ...b, stage: 'book' };
    expect(nextStep(b)).toEqual({ kind: 'chapter', index: 0 });
    b.chapters[0] = { ...b.chapters[0], text: 'היה היה', scene: 'kitchen' };
    expect(nextStep(b)).toEqual({ kind: 'art', index: 0 });
    expect(nextStep(b, { skipArt: new Set([b.chapters[0].id]) })).toEqual({ kind: 'chapter', index: 1 });
    expect(nextStep(b, { noArt: true })).toEqual({ kind: 'chapter', index: 1 });
    b.chapters[0].hasImage = true;
    b.chapters[1] = { ...b.chapters[1], text: 'סוף', scene: 's', hasImage: true };
    expect(nextStep(b)).toBe(null);
    expect(progress(b)).toMatchObject({ written: 2, total: 2, art: 2, done: true, percent: 100 });
  });

  it('בלי איורים: רק כותבים', () => {
    const b = { ...makeBook(BRIEF, OUTLINE, { art: false }), stage: 'book', hasCover: true };
    b.chapters[0] = { ...b.chapters[0], text: 'א', scene: 's' };
    expect(nextStep(b)).toEqual({ kind: 'chapter', index: 1 });
    expect(progress(b)).toMatchObject({ artTotal: 0, percent: 50 });
  });

  it('מפתחות התמונות והכריכה', () => {
    const b = { ...makeBook(BRIEF, OUTLINE, { photos: 2 }), hasCover: true };
    b.chapters[0].hasImage = true;
    expect(imageKeys(b)).toEqual(['cover', `c${b.chapters[0].id}`, 'p0', 'p1']);
    expect(coverKey(b)).toBe('cover');
    expect(coverKey({ ...b, coverKind: 'photo' })).toBe('p0');
    expect(coverKey({ ...b, hasCover: false })).toBe('');
  });

  it('שיתוף: בלי הבריף, רק פרקים שנכתבו', () => {
    const b = makeBook(BRIEF, OUTLINE, { photos: 1, coverKind: 'photo' });
    b.chapters[0] = { ...b.chapters[0], text: 'היה היה', hasImage: true };
    const s = toShared(b);
    expect(s.chapters).toHaveLength(1);
    expect(s.brief).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain('"answers"');
    expect(s).toMatchObject({ name: 'דנה', from: 'יואב', kid: false, cover: 'p0', photos: ['p0'] });
  });

  it('תצוגה ודפים: תמונת הכריכה לא חוזרת באלבום', () => {
    const b = makeBook(BRIEF, OUTLINE, { photos: 2, coverKind: 'photo' });
    b.chapters.forEach((c) => { c.text = 'טקסט'; });
    const v = toView(toShared(b), (k) => `u/${k}`);
    expect(v.coverSrc).toBe('u/p0');
    expect(v.photoSrcs).toEqual(['u/p1']);
    expect(pagesOf(v).map((p) => p.type)).toEqual(['cover', 'dedication', 'toc', 'chapter', 'chapter', 'album', 'end']);
    expect(pagesOf({ ...v, dedication: '', photoSrcs: [], chapters: v.chapters.slice(0, 1) }).map((p) => p.type)).toEqual(['cover', 'chapter', 'end']);
  });

  it('עזרים', () => {
    expect(paragraphs('א\n\nב\n \nג')).toEqual(['א', 'ב', 'ג']);
    expect(tail('abcdef', 3)).toBe('def');
    expect(outlineOf(makeBook(BRIEF, OUTLINE)).chapters[1]).toEqual({ title: 'ערב', summary: 'טיול' });
    expect(fitSize(4000, 2000, 1000)).toEqual({ w: 1000, h: 500 });
  });
});

describe('שאלון', () => {
  it('השאלות לפי אירוע, עם השם', () => {
    expect(questionsFor('kid', 'נועם')[0]).toContain('נועם');
    expect(questionsFor('birthday', '')[0]).toContain('מי שהספר עליו');
    expect(questionsFor('anniversary', 'x')).not.toEqual(questionsFor('birthday', 'x'));
  });

  it('רק תשובות שמולאו נשלחות', () => {
    expect(answered(['א', 'ב', 'ג'], ['', ' כן ', undefined])).toEqual([{ q: 'ב', a: 'כן' }]);
  });

  it('מה חסר כדי להתחיל', () => {
    expect(briefProblem(emptyBrief())).toMatch(/אירוע/);
    expect(briefProblem({ ...emptyBrief(), occasion: 'kid' })).toMatch(/על מי/);
    expect(briefProblem({ ...BRIEF, answers: [] })).toMatch(/שתי שאלות/);
    expect(briefProblem(BRIEF)).toBe('');
    expect(defaultsFor('kid')).toMatchObject({ tone: 'adventure', style: 'storybook' });
  });
});
