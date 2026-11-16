import { describe, expect, it } from 'vitest';
import { mergeConv } from './stable';

const file = (url) => ({ id: 'f1', kind: 'video', name: 'a.mp4', url, poster: 'p1' });

describe('mergeConv', () => {
  it('שומר את הכתובת הראשונה ואת אותו אובייקט הודעה', () => {
    const prev = { id: 'c', messages: [{ i: 1, who: 'owner', text: 'א', files: [file('u1')] }] };
    const next = { id: 'c', messages: [{ i: 1, who: 'owner', text: 'א', files: [file('u2')] }, { i: 2, who: 'x', text: 'ב' }] };
    const out = mergeConv(prev, next);
    expect(out.messages[0]).toBe(prev.messages[0]);
    expect(out.messages[0].files[0].url).toBe('u1');
    expect(out.messages).toHaveLength(2);
  });
  it('הודעה ששונתה מתעדכנת', () => {
    const prev = { id: 'c', messages: [{ i: 1, who: 'x', text: 'א', renders: [{ id: 'r', status: 'queued' }] }] };
    const next = { id: 'c', messages: [{ i: 1, who: 'x', text: 'א', renders: [{ id: 'r', status: 'done', file: file('u9') }] }] };
    const out = mergeConv(prev, next);
    expect(out.messages[0].renders[0].status).toBe('done');
    expect(out.messages[0].renders[0].file.url).toBe('u9');
  });
  it('שיחה אחרת – בלי מיזוג', () => {
    const next = { id: 'd', messages: [] };
    expect(mergeConv({ id: 'c', messages: [] }, next)).toBe(next);
  });
});
