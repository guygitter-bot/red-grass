import { RecipeBook } from './store.js';
import { Accounts } from './accounts.js';

// זיכרון מדומה במקום האחסון של Cloudflare
function fakeStorage() {
  const map = new Map();
  return {
    map,
    async get(k) { return map.get(k); },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, structuredClone(vv));
      else map.set(k, structuredClone(v));
    },
    async delete(k) { for (const kk of [k].flat()) map.delete(kk); },
    async deleteAll() { map.clear(); },
    async list({ prefix } = {}) {
      return new Map([...map].filter(([kk]) => kk.startsWith(prefix || '')).map(([kk, vv]) => [kk, structuredClone(vv)]));
    },
  };
}

function namespace(Cls, env) {
  const objects = new Map();
  return {
    objects,
    idFromName: (n) => n,
    get: (n) => {
      if (!objects.has(n)) objects.set(n, new Cls({ storage: fakeStorage() }, env));
      const obj = objects.get(n);
      return { fetch: (req) => obj.fetch(req) };
    },
  };
}

export function fakeEnv(extra = {}) {
  const env = { ANTHROPIC_API_KEY: 'sk-ant-secret', ALLOWED_ORIGINS: 'https://mat-kon.pages.dev', FREE_RECIPES: '10', PAYMENT_URL: '', OWNER_OPEN: 'true', ...extra };
  env.BOOK = namespace(RecipeBook, env);
  env.ACCOUNTS = namespace(Accounts, env);
  return env;
}
