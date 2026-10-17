import { SharedFoods } from './foods.js';

// זיכרון מדומה במקום האחסון של Cloudflare
export function fakeEnv() {
  const map = new Map();
  const storage = {
    async get(k) { return map.get(k); },
    async put(k, v) { map.set(k, v); },
    async delete(k) { return map.delete(k); },
    async list({ prefix, limit } = {}) {
      const entries = [...map].filter(([k]) => k.startsWith(prefix || '')).slice(0, limit ?? Infinity);
      return new Map(entries);
    },
  };
  const obj = new SharedFoods({ storage });
  return {
    ANTHROPIC_API_KEY: 'k', ACCESS_CODE: 'code123', ADMIN_CODE: 'admin999', ALLOWED_ORIGINS: 'https://app.example',
    FOODS: { idFromName: (n) => n, get: () => ({ fetch: (req) => obj.fetch(req) }) },
  };
}

