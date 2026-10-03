import { RecipeBook } from './store.js';

// זיכרון מדומה במקום האחסון של Cloudflare
export function fakeEnv() {
  const map = new Map();
  const storage = {
    async get(k) { return map.get(k); },
    async put(k, v) { map.set(k, structuredClone(v)); },
    async delete(k) { return map.delete(k); },
    async list({ prefix } = {}) {
      return new Map([...map].filter(([k]) => k.startsWith(prefix || '')));
    },
  };
  const book = new RecipeBook({ storage });
  return {
    ANTHROPIC_API_KEY: 'sk-ant-secret',
    ACCESS_CODE: 'code123',
    ALLOWED_ORIGINS: 'https://mat-kon.pages.dev',
    BOOK: { idFromName: (n) => n, get: () => ({ fetch: (req) => book.fetch(req) }) },
  };
}
