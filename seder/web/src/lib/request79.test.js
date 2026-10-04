import { describe, expect, it } from 'vitest';
import { addTask, emptyState, makeTask, moveCategory, moveItem, moveTask, normalize, sortManual, sortTasks, updateTask } from './store';
import { applyRemote } from './sync';

const ids = (list) => list.map((x) => x.id);

describe('משיכה באצבע – הזזה בין פריטים', () => {
  it('הפריט נכנס למקום החדש והשאר זזים', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    const same = ['a', 'b'];
    expect(moveItem(same, 1, 1)).toBe(same);
    expect(moveItem(same, 0, 5)).toBe(same);
  });

  it('תחום שנמשך כמה מקומות לא מחליף מקום עם תחום אחר', () => {
    const s = moveCategory(emptyState(), 'guy', -3);
    expect(ids(s.categories)).toEqual(['care', 'home', 'guy', 'work', 'errands', 'kids']);
    expect(s.categories.map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('סדר ידני של משימות בתחום', () => {
  const t = (id, fields = {}) => makeTask({ id, title: id, categoryId: 'work', ...fields });

  it('בלי הזזה – אותו סדר כמו קודם', () => {
    const list = [t('b', { due: '2026-10-09' }), t('a', { due: '2026-10-05' }), t('c', { done: true }), t('d')];
    expect(ids(sortManual(list))).toEqual(ids(sortTasks(list)));
  });

  it('אחרי הזזה הסדר נשמר, חדשות למעלה ובוצעו בסוף', () => {
    let s = emptyState();
    s = { ...s, tasks: [t('a', { due: '2026-10-05' }), t('b', { due: '2026-10-06' }), t('c', { due: '2026-10-07' })] };
    const shown = ids(sortManual(s.tasks));
    expect(shown).toEqual(['a', 'b', 'c']);
    s = moveTask(s, shown, 2, 0);
    expect(ids(sortManual(s.tasks))).toEqual(['c', 'a', 'b']);
    expect(s.tasks.every((x) => x.updatedAt)).toBe(true);

    s = addTask(s, { title: 'חדשה', categoryId: 'work' });
    expect(sortManual(s.tasks)[0].title).toBe('חדשה');

    s = updateTask(s, 'c', { done: true });
    expect(ids(sortManual(s.tasks)).at(-1)).toBe('c');
  });

  it('הזזה למקום שלא השתנה לא נוגעת בכלום', () => {
    const s = { ...emptyState(), tasks: [t('a'), t('b')] };
    expect(moveTask(s, ['a', 'b'], 1, 1)).toBe(s);
  });

  it('משימה שעוברת לתחום אחר מאבדת את הסדר הידני', () => {
    let s = { ...emptyState(), tasks: [t('a'), t('b')] };
    s = moveTask(s, ['a', 'b'], 0, 1);
    expect(s.tasks.find((x) => x.id === 'a').order).toBe(1);
    s = updateTask(s, 'a', { title: 'שם חדש', categoryId: 'work' });
    expect(s.tasks.find((x) => x.id === 'a').order).toBe(1);
    s = updateTask(s, 'a', { categoryId: 'home' });
    expect(s.tasks.find((x) => x.id === 'a').order).toBe(null);
  });

  it('משימות ישנות נטענות בלי שינוי, והסדר עובר בסנכרון', () => {
    const old = normalize({ tasks: [{ id: 'x', title: 'ישנה', categoryId: 'work' }] });
    expect(old.tasks[0]).toEqual({ id: 'x', title: 'ישנה', categoryId: 'work' });

    let phone = { ...emptyState(), tasks: [t('a'), t('b'), t('c')] };
    phone = moveTask(phone, ['a', 'b', 'c'], 0, 2);
    const records = phone.tasks.map((x) => ({ kind: 'task', id: x.id, data: x, updatedAt: x.updatedAt }));
    const pc = applyRemote(emptyState(), [], { cursor: 3, records });
    expect(ids(sortManual(pc.tasks))).toEqual(['b', 'c', 'a']);
  });
});
