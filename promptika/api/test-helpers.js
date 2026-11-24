// כלים משותפים לבדיקות: אחסון מדומה ושרת מדומה
import worker, { Studio } from './worker.js';

export const ORIGIN = 'https://promptika.pages.dev';

// זיכרון מדומה במקום האחסון של Durable Object
export function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    async get(k) { return clone(map.get(k)); },
    async put(k, v) { map.set(k, clone(v)); },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async list({ prefix = '' } = {}) {
      const keys = [...map.keys()].filter((kk) => kk.startsWith(prefix)).sort();
      return new Map(keys.map((kk) => [kk, clone(map.get(kk))]));
    },
  };
}

export function setup(studioEnv = {}) {
  const storage = fakeStorage();
  const studio = new Studio({ storage }, studioEnv);
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    STUDIO: { idFromName: () => 'main', get: () => ({ fetch: (req) => studio.fetch(req) }) },
  };
  const call = async (method, path, body, token, origin = ORIGIN) => {
    const res = await worker.fetch(new Request(`https://api.test${path}`, {
      method,
      headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), env);
    return { status: res.status, data: await res.json() };
  };
  return { storage, call };
}

