import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { Vault } from '../../../api/worker.js';
import { addTask, emptyState, removeCategory, removeTask, toggleDone, updateTask, upsertCategory } from './store';
import { collectChanges, getToken, login, runSync } from './sync';
import { unlock } from './lock';

// "שרת" אמיתי (הקוד של seder/api) עם אחסון בזיכרון, ושני מכשירים שמסתנכרנים דרכו
function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    async get(k) { return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k)); },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '', start = '', limit = Infinity } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix) && kk >= start).sort().slice(0, limit);
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

function device() {
  let state = emptyState();
  return {
    get state() { return state; },
    act(fn, ...args) { state = fn(state, ...args); },
    sync: () => runSync(() => state, (fn) => { state = fn(state); }),
  };
}

let clock = 1000;
beforeEach(async () => {
  const env = { SEDER_PASSWORD: 'pw', ALLOWED_ORIGINS: '' };
  const vault = new Vault({ storage: fakeStorage() }, env);
  env.VAULT = { idFromName: (n) => n, get: () => ({ fetch: (r) => vault.fetch(r) }) };
  vi.stubGlobal('fetch', (url, init) => worker.fetch(new Request(url, init), env));
  const ls = new Map();
  vi.stubGlobal('localStorage', { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v), removeItem: (k) => ls.delete(k) });
  // שעון שמתקדם בכל פעולה, כדי שסדר העריכות יהיה ברור
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 10));
  await login('pw');
});

describe('sync between phone and computer', () => {
  it('rejects a wrong password', async () => {
    await expect(login('nope')).rejects.toThrow('סיסמה שגויה');
  });

  it('existing phone data reaches a new computer', async () => {
    const phone = device();
    phone.act(addTask, { title: 'לקנות חלב', due: '2026-10-05' });
    phone.act(upsertCategory, { id: 'health', name: 'בריאות', emoji: '🩺', color: 'emerald' });
    await phone.sync();
    expect(collectChanges(phone.state)).toEqual([]);

    const pc = device();
    await pc.sync();
    expect(pc.state.tasks.map((t) => t.title)).toEqual(['לקנות חלב']);
    expect(pc.state.categories.map((c) => c.name)).toContain('בריאות');
    expect(pc.state.categories).toHaveLength(7);
  });

  it('edits, completions and deletions flow both ways', async () => {
    const phone = device();
    const pc = device();
    phone.act(addTask, { title: 'א' });
    phone.act(addTask, { title: 'ב' });
    await phone.sync();
    await pc.sync();
    const [a, b] = pc.state.tasks;

    pc.act(toggleDone, a.id);
    pc.act(removeTask, b.id);
    pc.act(addTask, { title: 'ג (מהמחשב)' });
    pc.act(removeCategory, 'guy');
    await pc.sync();
    await phone.sync();

    expect(phone.state.tasks.map((t) => [t.title, t.done])).toEqual([['א', true], ['ג (מהמחשב)', false]]);
    expect(phone.state.categories.some((c) => c.id === 'guy')).toBe(false);
    expect(phone.state.tasks).toEqual(pc.state.tasks);
  });

  it('the later edit of the same task wins', async () => {
    const phone = device();
    const pc = device();
    phone.act(addTask, { title: 'פגישה' });
    await phone.sync();
    await pc.sync();
    const id = phone.state.tasks[0].id;
    phone.act(updateTask, id, { title: 'פגישה בטלפון' });
    pc.act(updateTask, id, { title: 'פגישה במחשב' }); // מאוחר יותר
    await phone.sync();
    await pc.sync();
    await phone.sync();
    expect(phone.state.tasks[0].title).toBe('פגישה במחשב');
    expect(pc.state.tasks[0].title).toBe('פגישה במחשב');
  });

  it('a deletion on the phone reaches the computer', async () => {
    const phone = device();
    const pc = device();
    phone.act(addTask, { title: 'משימה' });
    await phone.sync();
    await pc.sync();
    const id = phone.state.tasks[0].id;
    phone.act(removeTask, id);
    await phone.sync();
    await pc.sync();
    expect(pc.state.tasks).toEqual([]);
  });

  it('stops and asks to log in again when the password changed', async () => {
    localStorage.setItem('seder_token', 'old-token');
    const phone = device();
    await expect(phone.sync()).rejects.toThrow('צריך להתחבר מחדש');
  });
});

describe('lock screen password', () => {
  it('opens with the right password and saves a local check', async () => {
    localStorage.removeItem('seder_token');
    expect(await unlock('nope')).toEqual({ ok: false, error: 'סיסמה שגויה' });
    expect(await unlock('pw')).toEqual({ ok: true, online: true });
    expect(getToken()).toBeTruthy();
    expect(localStorage.getItem('seder_verifier')).not.toContain('pw');
  });

  it('opens without internet only after one online login, and still checks the password', async () => {
    const offline = () => vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    localStorage.removeItem('seder_verifier');
    offline();
    expect((await unlock('pw')).ok).toBe(false);
    vi.unstubAllGlobals();
    // כניסה אחת עם רשת
    const env = { SEDER_PASSWORD: 'pw', ALLOWED_ORIGINS: '' };
    const vault = new Vault({ storage: fakeStorage() }, env);
    env.VAULT = { idFromName: (n) => n, get: () => ({ fetch: (r) => vault.fetch(r) }) };
    const ls = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v), removeItem: (k) => ls.delete(k) });
    vi.stubGlobal('fetch', (url, init) => worker.fetch(new Request(url, init), env));
    expect((await unlock('pw')).ok).toBe(true);
    offline();
    expect(await unlock('pw')).toEqual({ ok: true, online: false });
    expect((await unlock('wrong')).ok).toBe(false);
  });
});
