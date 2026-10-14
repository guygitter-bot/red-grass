// קבצים ותמונות שמצורפים למשימות. נשמרים בכספת (Durable Object), מחולקים לחתיכות,
// כי לכל ערך באחסון יש גבול גודל. במשימה עצמה נשמרים רק הפרטים: { id, name, type, size }.
//
// אחסון:
//   fm:<id>     -> { id, name, type, size, chunks, createdAt }
//   fc:<id>:<n> -> חתיכה n של הקובץ (base64)
//
// קובץ שאף משימה כבר לא מצביעה עליו (המשימה נמחקה או שהקובץ הוסר ממנה) נמחק אחרי יום –
// כדי שקובץ שהועלה רגע לפני שמירת המשימה לא יימחק בטעות.

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const CHUNK_CHARS = 512 * 1024;
export const ORPHAN_AFTER_MS = 24 * 3600 * 1000;
const ID_RE = /^[\w-]{8,64}$/;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

const metaKey = (id) => `fm:${id}`;
const chunkKey = (id, n) => `fc:${id}:${String(n).padStart(4, '0')}`;

// גודל הקובץ לפי אורך ה-base64
export function base64Bytes(data) {
  return Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
}

// בדיקת קובץ שהגיע מהמכשיר. מחזיר { file } או { error }
export function cleanFile(body) {
  const { id, name, type, data } = body || {};
  if (typeof id !== 'string' || !ID_RE.test(id)) return { error: 'מזהה קובץ לא תקין' };
  if (typeof data !== 'string' || !data.length || data.length % 4 !== 0 || !B64_RE.test(data)) return { error: 'הקובץ לא תקין' };
  const size = base64Bytes(data);
  if (size > MAX_FILE_BYTES) return { error: 'הקובץ גדול מדי (עד 4MB)' };
  return {
    file: {
      id,
      name: String(name || 'קובץ').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120) || 'קובץ',
      type: /^[\w.+-]+\/[\w.+-]+$/.test(String(type || '')) ? String(type).slice(0, 100) : 'application/octet-stream',
      size,
      data,
    },
  };
}

export async function putFile(storage, file, now = Date.now()) {
  const old = await storage.get(metaKey(file.id));
  if (old) await removeFile(storage, file.id, old);
  const chunks = Math.max(1, Math.ceil(file.data.length / CHUNK_CHARS));
  for (let n = 0; n < chunks; n += 1) await storage.put(chunkKey(file.id, n), file.data.slice(n * CHUNK_CHARS, (n + 1) * CHUNK_CHARS));
  const meta = { id: file.id, name: file.name, type: file.type, size: file.size, chunks, createdAt: now };
  // הפרטים נכתבים אחרונים: קובץ בלי fm (העלאה שנקטעה) לא נחשב כקיים
  await storage.put(metaKey(file.id), meta);
  return { id: meta.id, name: meta.name, type: meta.type, size: meta.size };
}

export async function getFile(storage, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const meta = await storage.get(metaKey(id));
  if (!meta) return null;
  const keys = Array.from({ length: meta.chunks }, (_, n) => chunkKey(id, n));
  const parts = await storage.get(keys);
  if (keys.some((k) => typeof parts.get(k) !== 'string')) return null;
  return { id, name: meta.name, type: meta.type, size: meta.size, data: keys.map((k) => parts.get(k)).join('') };
}

export async function removeFile(storage, id, meta) {
  const m = meta || (await storage.get(metaKey(id)));
  if (!m) return;
  await storage.delete([metaKey(id), ...Array.from({ length: m.chunks }, (_, n) => chunkKey(id, n))]);
}

// מוחק קבצים שאף משימה (שלא נמחקה) לא מצביעה עליהם, ושהועלו לפני יותר מיום
export async function cleanupFiles(storage, now = Date.now()) {
  const metas = await storage.list({ prefix: 'fm:' });
  if (!metas.size) return 0;
  const used = new Set();
  for (const rec of (await storage.list({ prefix: 'r:task:' })).values()) {
    if (rec.deleted) continue;
    for (const a of Array.isArray(rec.data?.attachments) ? rec.data.attachments : []) if (a?.id) used.add(a.id);
  }
  let removed = 0;
  for (const meta of metas.values()) {
    if (used.has(meta.id) || now - meta.createdAt < ORPHAN_AFTER_MS) continue;
    await removeFile(storage, meta.id, meta);
    removed += 1;
  }
  return removed;
}
