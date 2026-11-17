// שרת מקומי לבדיקות (נתונים בזיכרון): node dev.mjs  -> http://localhost:8787
import http from 'node:http';
import worker, { Series } from './worker.js';

const map = new Map();
const storage = { get: async (k) => structuredClone(map.get(k)), put: async (k, v) => void map.set(k, structuredClone(v)) };
const obj = new Series({ storage });
const env = { ALLOWED_ORIGINS: 'http://localhost:4173,http://localhost:5173', SERIES: { idFromName: (n) => n, get: () => obj } };

http
  .createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const r = await worker.fetch(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
  })
  .listen(8787, () => console.log('http://localhost:8787'));
