// השרת המקומי של הסטודיו: מגיש את האפליקציה, את קובצי המדיה, את ה-API ואת שרת ה-MCP.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DIRS, subscribe, publicState, jobs, publicJob, project } from './store.js';
import { ACTIONS, runAction, meta, inputSchema } from './actions.js';
import { saveUpload, registerMedia } from './media.js';
import { toSrt } from './edit.js';
import { ensureSfx } from './sfx.js';

const PORT = Number(process.env.PORT) || 4747;
const HOST = process.env.HOST || '0.0.0.0';
const VERSION = '1.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function readJson(req, limit = 20e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (d) => { size += d.length; if (size > limit) { reject(new Error('request too large')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString();
      if (!text.trim()) return resolve({});
      try { resolve(JSON.parse(text)); } catch { reject(new Error('the request body is not valid JSON')); }
    });
    req.on('error', reject);
  });
}

// קובץ מהדיסק, כולל בקשות לחלק מהקובץ (Range) – בלי זה אי אפשר לדלג בתוך סרטון
function sendFile(req, res, file, { download, cache = 'no-cache' } = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' });
    const headers = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes', 'Cache-Control': cache,
    };
    if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      let end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) return send(res, 416, '', { 'Content-Range': `bytes */${st.size}` });
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// קובץ מתוך תיקייה, בלי אפשרות לצאת ממנה
function inside(dir, name) {
  const file = path.join(dir, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
  return file.startsWith(dir) ? file : null;
}

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// ---------- MCP (Streamable HTTP, בלי מצב) ----------
const MCP_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

async function mcpCall(msg, ctx) {
  const { id, method, params = {} } = msg;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined) return null; // הודעת עדכון, אין תשובה
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: MCP_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : MCP_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'video-studio', title: 'Video Studio', version: VERSION },
        instructions: 'A local video editor. Call get_project first. Times are seconds on the timeline. Typical flow: import_media -> add_clip -> remove_silences -> transcribe -> set_caption_style -> add_text / add_sound -> export.',
      });
    case 'ping': return ok({});
    case 'tools/list':
      return ok({ tools: ACTIONS.map((a) => ({ name: a.name, description: a.description, inputSchema: inputSchema(a) })) });
    case 'tools/call':
      try {
        const result = await runAction(params.name, params.arguments || {}, ctx);
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    case 'resources/list': return ok({ resources: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return fail(-32601, `method not found: ${method}`);
  }
}

async function handleMcp(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' }, { Allow: 'POST' });
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  const ctx = { local: isLocal(req) };
  const replies = (await Promise.all((Array.isArray(body) ? body : [body]).map((m) => mcpCall(m, ctx)))).filter(Boolean);
  if (!replies.length) return send(res, 202, '');
  send(res, 200, Array.isArray(body) ? replies : replies[0]);
}

// ---------- הנתיבים ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  // דף אינטרנט זר לא יכול לשלוח פקודות לעורך: בקשה מדפדפן חייבת לבוא מהכתובת של הסטודיו עצמו
  const origin = req.headers.origin;
  if (origin && req.method !== 'GET' && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'cross-origin requests are not allowed' });

  if (p === '/mcp') return handleMcp(req, res);

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: project\ndata: ${JSON.stringify(publicState())}\n\n`);
    for (const j of jobs.values()) if (j.status === 'running') res.write(`event: job\ndata: ${JSON.stringify(publicJob(j))}\n\n`);
    subscribe(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    res.on('close', () => clearInterval(ping));
    return;
  }
  if (p === '/api/project' && req.method === 'GET') return send(res, 200, publicState());
  if (p === '/api/meta') return send(res, 200, { ...meta(), version: VERSION, port: PORT });
  if (p === '/api/actions') return send(res, 200, meta().actions);
  if (p === '/api/captions.srt') return send(res, 200, toSrt(project), { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="captions.srt"' });

  if (p === '/api/upload' && req.method === 'POST') {
    try {
      const name = url.searchParams.get('name') || 'file';
      const file = await saveUpload(req, name);
      const { media, done } = await registerMedia(file, name);
      if (url.searchParams.get('wait')) await done;
      return send(res, 200, media);
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (p.startsWith('/api/') && req.method === 'POST') {
    try {
      const args = await readJson(req);
      return send(res, 200, { ok: true, result: (await runAction(p.slice(5), args, { local: isLocal(req) })) ?? null });
    } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }); }
  }
  if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
  for (const [prefix, dir, opts] of [
    ['/media/', DIRS.media, { cache: 'private, max-age=86400' }], ['/sfx/', DIRS.sfx, { cache: 'private, max-age=86400' }],
    ['/fonts/', DIRS.fonts, { cache: 'private, max-age=86400' }], ['/exports/', DIRS.exports, { download: url.searchParams.has('download') }],
  ]) {
    if (p.startsWith(prefix)) {
      const file = inside(dir, p.slice(prefix.length));
      return file ? sendFile(req, res, file, opts) : send(res, 404, { error: 'not found' });
    }
  }
  const file = inside(DIRS.web, p === '/' ? 'index.html' : p.slice(1));
  return file ? sendFile(req, res, file) : send(res, 404, { error: 'not found' });
}

ensureSfx();
const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { if (!res.headersSent) send(res, 500, { error: e.message }); else res.end(); });
});
server.requestTimeout = 0; // העלאות וייצוא ארוכים
server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n  סטודיו וידאו פועל · Video Studio is running\n`);
  console.log(`  במחשב / on this computer:   http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  בטלפון (אותו Wi-Fi) / phone: http://${ip}:${PORT}`);
  console.log(`  MCP:                        http://localhost:${PORT}/mcp`);
  console.log(`  API:                        http://localhost:${PORT}/api/actions\n`);
});
