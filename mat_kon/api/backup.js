// גיבוי לילי של כל הספרים ל-R2 (הדלי mat-kon-backups, binding בשם BACKUPS – פרטי, רק לבעל האפליקציה):
//   daily/<תאריך>/accounts.json      המשתמשים וההזמנות
//   daily/<תאריך>/books/<ספר>.json   כל הנתונים של ספר (מתכונים, רשימות, הגדרות) בלי התמונות
//   images/<ספר>/<מזהה>              כל תמונה נשמרת פעם אחת (לא משתנה), ומשותפת לכל הימים
//   daily/<תאריך>/done.json          סיכום – מסמן שהגיבוי של היום הושלם
// נשמרים BACKUP_DAYS הימים האחרונים. שחזור ספר: POST /admin/restore (רק בעל האפליקציה, mat-kon-restore.yml).
export const BACKUP_DAYS = 30;

const call = (stub, method, path, body) =>
  stub.fetch(new Request(`https://do${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

const bookStub = (env, key) => env.BOOK.get(env.BOOK.idFromName(key === 'book' ? 'book' : `user:${key}`));
const accountsStub = (env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts'));
const day = (d = new Date()) => d.toISOString().slice(0, 10);

function toBase64(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function runBackup(env, now = new Date()) {
  if (!env.BACKUPS) return { skipped: 'no BACKUPS bucket' };
  const date = day(now);
  const accounts = await (await call(accountsStub(env), 'GET', '/backup/export')).json();
  await env.BACKUPS.put(`daily/${date}/accounts.json`, JSON.stringify(accounts));
  // ספר של בעל האפליקציה + ספר לכל משתמש שמחזיק ספר משלו (חבר בספר משותף עובד על הספר של מי שהזמין)
  const holders = Object.entries(accounts.data)
    .filter(([k, u]) => k.startsWith('user:') && u && !u.bookId && !u.removed)
    .map(([, u]) => u.id);
  const books = ['book', ...holders];
  let images = 0;
  for (const key of books) {
    const stub = bookStub(env, key);
    const dump = await (await call(stub, 'GET', '/backup/export')).json();
    await env.BACKUPS.put(`daily/${date}/books/${key}.json`, JSON.stringify(dump));
    for (const id of dump.images) {
      const name = `images/${key}/${id}`;
      if (await env.BACKUPS.head(name)) continue;
      const res = await call(stub, 'GET', `/img/${id}`);
      if (!res.ok) continue;
      await env.BACKUPS.put(name, await res.arrayBuffer(), { httpMetadata: { contentType: res.headers.get('content-type') || 'image/jpeg' } });
      images += 1;
    }
  }
  const summary = { date, at: now.toISOString(), books: books.length, newImages: images };
  await env.BACKUPS.put(`daily/${date}/done.json`, JSON.stringify(summary));
  await pruneOld(env, now);
  return summary;
}

// מוחק ימים ישנים מ-BACKUP_DAYS (התמונות נשארות – הן קטנות ומשותפות לכל הימים)
async function pruneOld(env, now) {
  const oldest = day(new Date(now.getTime() - BACKUP_DAYS * 86400000));
  for (const date of await listDays(env)) {
    if (date >= oldest) continue;
    let cursor;
    do {
      const page = await env.BACKUPS.list({ prefix: `daily/${date}/`, cursor });
      if (page.objects.length) await env.BACKUPS.delete(page.objects.map((o) => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}

export async function listDays(env) {
  const days = [];
  let cursor;
  do {
    const page = await env.BACKUPS.list({ prefix: 'daily/', delimiter: '/', cursor });
    for (const p of page.delimitedPrefixes || []) days.push(p.slice(6, -1));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return days.sort();
}

// הגיבויים הקיימים (למסך "עלויות ותקלות")
export async function backupStatus(env) {
  if (!env.BACKUPS) return { enabled: false, days: [] };
  const days = await listDays(env);
  const last = days.at(-1);
  const done = last ? await env.BACKUPS.get(`daily/${last}/done.json`) : null;
  return { enabled: true, days, last: done ? await done.json() : null };
}

// שחזור ספר אחד ממועד מסוים: הספר הנוכחי מוחלף כולו בגרסה מהגיבוי (כולל התמונות)
export async function restoreBook(env, date, key) {
  if (!env.BACKUPS) throw new Error('אין דלי גיבוי');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(book|[0-9a-f-]{36})$/.test(key)) throw new Error('תאריך או ספר לא תקינים');
  const file = await env.BACKUPS.get(`daily/${date}/books/${key}.json`);
  if (!file) throw new Error('אין גיבוי של הספר הזה בתאריך הזה');
  const dump = await file.json();
  const stub = bookStub(env, key);
  await call(stub, 'POST', '/backup/import', { data: dump.data });
  let images = 0;
  for (const id of dump.images) {
    const img = await env.BACKUPS.get(`images/${key}/${id}`);
    if (!img) continue;
    await call(stub, 'POST', '/backup/image', { id, type: img.httpMetadata?.contentType || 'image/jpeg', data: toBase64(await img.arrayBuffer()) });
    images += 1;
  }
  return { date, book: key, keys: Object.keys(dump.data).length, images };
}
