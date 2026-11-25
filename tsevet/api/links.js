// קישור מגוגל (Drive / Docs / Sheets / Slides) או קישור ישיר לקובץ -> קובץ בשיחה, כאילו הבעלים העלה אותו.
//   import_link – כל בוט באפליקציה. סרטון ארוך מ-Drive נשמר ב-R2 בזרימה (בלי להחזיק אותו בזיכרון), ואז עורך הווידאו
//                 עובד עליו כמו על כל סרטון שהועלה. Docs / Sheets / Slides יורדים כטקסט / CSV (מסמך שהבוטים קוראים).
//   הקובץ חייב להיות משותף "לכל מי שיש לו את הקישור" – אנחנו לא מתחברים לחשבון הגוגל של הבעלים.
import { addFile, newId } from './app.js';

// גבולות לקובץ מקישור (גדולים יותר מהעלאה מהטלפון: סרטון מ-Drive יכול להיות ארוך)
export const LINK_MAX = { video: 500 * 1024 * 1024, audio: 100 * 1024 * 1024, image: 30 * 1024 * 1024, doc: 20 * 1024 * 1024 };
const mb = (n) => `${Math.round(n / 1024 / 1024)}MB`;
const NOT_SHARED = 'Google asked to sign in – the file is not shared publicly. Ask the owner to open it in Drive → Share → General access: "Anyone with the link", then send the link again.';
const PART = 10 * 1024 * 1024;

// דף האזהרה של Drive לקבצים גדולים: טופס עם id / export / confirm / uuid -> כתובת להורדה
export function scanFormUrl(html) {
  if (!/download-form|name="uuid"/.test(html)) return null;
  const action = (html.match(/<form[^>]*id="download-form"[^>]*action="([^"]+)"/) || html.match(/<form[^>]*action="([^"]+)"[^>]*id="download-form"/) || [])[1] || 'https://drive.usercontent.google.com/download';
  const url = new URL(action.replace(/&amp;/g, '&'));
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = (m[0].match(/name="([^"]+)"/) || [])[1];
    const value = (m[0].match(/value="([^"]*)"/) || [])[1];
    if (name) url.searchParams.set(name, (value || '').replace(/&amp;/g, '&'));
  }
  return url.searchParams.get('id') ? url.toString() : null;
}

// שמירה ב-R2 בלי להחזיק סרטון שלם בזיכרון: אורך ידוע – זרימה ישירה; לא ידוע – העלאה בחלקים של 10MB.
// מחזיר את הגודל, או 0 כשהקובץ עבר את התקרה
async function store(bucket, key, res, len, max, contentType) {
  const meta = { httpMetadata: { contentType } };
  if (len && typeof FixedLengthStream !== 'undefined') {
    const fixed = new FixedLengthStream(len);
    const piped = res.body.pipeTo(fixed.writable);
    await bucket.put(key, fixed.readable, meta);
    await piped;
    return len;
  }
  if (!bucket.createMultipartUpload) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > max) return 0;
    await bucket.put(key, bytes, meta);
    return bytes.length;
  }
  const upload = await bucket.createMultipartUpload(key, meta);
  const parts = [];
  // חלקים בגודל זהה בדיוק (דרישה של R2), רק האחרון קטן יותר
  const buf = new Uint8Array(PART);
  let fill = 0;
  let total = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel().catch(() => {});
        await upload.abort().catch(() => {});
        return 0;
      }
      let o = 0;
      while (o < value.length) {
        const n = Math.min(PART - fill, value.length - o);
        buf.set(value.subarray(o, o + n), fill);
        fill += n;
        o += n;
        if (fill === PART) {
          parts.push(await upload.uploadPart(parts.length + 1, buf.slice()));
          fill = 0;
        }
      }
    }
    if (fill || !parts.length) parts.push(await upload.uploadPart(parts.length + 1, buf.slice(0, fill)));
    await upload.complete(parts);
    return total;
  } catch (e) {
    await upload.abort().catch(() => {});
    throw e;
  }
}

export const LINK_TOOLS = [
  {
    name: 'import_link',
    description: 'Bring a file into this conversation from a link: Google Drive (any file – video, image, audio, PDF), Google Docs / Sheets / Slides (as text / CSV), or a direct https link to a file. After it, the file appears in the chat as [file <id>: ...] and you (or the video editor) can use it like an upload. The file must be shared "Anyone with the link".',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The link exactly as the owner sent it' },
        name: { type: 'string', description: 'Optional file name to show (Hebrew or English)' },
      },
      required: ['url'],
    },
  },
];

// מה הקישור: { url להורדה, סוג גוגל } או null
export function linkTarget(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || (/^[\w-]{10,}$/.test(u.searchParams.get('id') || '') ? u.searchParams.get('id') : null);
  if (host === 'docs.google.com' && id) {
    if (u.pathname.startsWith('/document/')) return { google: 'doc', id, url: `https://docs.google.com/document/d/${id}/export?format=txt`, ext: 'txt' };
    if (u.pathname.startsWith('/spreadsheets/')) {
      const gid = (u.hash.match(/gid=(\d+)/) || u.search.match(/gid=(\d+)/) || [])[1];
      return { google: 'sheet', id, url: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`, ext: 'csv' };
    }
    if (u.pathname.startsWith('/presentation/')) return { google: 'slides', id, url: `https://docs.google.com/presentation/d/${id}/export/txt`, ext: 'txt' };
  }
  if ((host === 'drive.google.com' || host === 'docs.google.com' || host === 'drive.usercontent.google.com') && id) {
    return { google: 'drive', id, url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` };
  }
  if (/google\.com$/.test(host) || host === 'photos.app.goo.gl') return { unsupported: true };
  return { url: u.toString() };
}

const kindOf = (type) => {
  const t = String(type || '').toLowerCase();
  if (/^video\//.test(t)) return 'video';
  if (/^image\/(jpeg|png|webp|gif)$/.test(t)) return 'image';
  if (/^audio\//.test(t)) return 'audio';
  if (t === 'application/pdf') return 'doc';
  if (/^text\/(plain|csv)/.test(t)) return 'doc';
  return null;
};

// שם הקובץ מהכותרת Content-Disposition (כולל filename*=UTF-8'')
function fileName(cd) {
  const star = String(cd || '').match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // שם לא תקין
    }
  }
  return (String(cd || '').match(/filename="?([^";]+)"?/i) || [])[1] || '';
}

export async function importLink(t, input, made) {
  const { storage, env } = t;
  if (!env.FILES) return 'File storage is not connected.';
  const target = linkTarget(input.url);
  if (!target) return 'That is not a valid https link.';
  if (target.unsupported) return 'This kind of Google link (e.g. Google Photos) can\'t be downloaded. Ask the owner for a Google Drive share link ("Anyone with the link") or to upload the file.';
  const get = (url) => (env.FETCH || fetch)(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 tsevet' } });
  let res;
  try {
    res = await get(target.url);
    // קובץ גדול ב-Drive: דף "לא ניתן לסרוק לאיתור וירוסים" עם טופס – מורידים שוב לפי השדות שבטופס
    if (target.google === 'drive' && /text\/html/.test(res.headers.get('content-type') || '')) {
      const html = await res.text();
      const again = scanFormUrl(html);
      if (!again) return NOT_SHARED;
      res = await get(again);
    }
  } catch {
    return 'Could not reach the link. Ask the owner to check it.';
  }
  if (!res.ok) return res.status === 404 ? 'The file was not found – check the link.' : NOT_SHARED;
  // דף התחברות / HTML במקום הקובץ = לא משותף (נבדק לפני שמחליטים שזה טקסט)
  if (/accounts\.google\.com/.test(res.url || '') || /text\/html/.test(res.headers.get('content-type') || '')) return NOT_SHARED;
  let type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  // Google Docs / Sheets / Slides: טקסט / CSV
  if (target.google && target.google !== 'drive') type = 'text/plain';
  let name = String(input.name || '').trim() || fileName(res.headers.get('content-disposition')) || `קובץ.${target.ext || (type.split('/')[1] || 'bin')}`;
  // Drive מחזיר לפעמים application/octet-stream – מנחשים לפי הסיומת
  if (!kindOf(type)) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    type = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv' }[ext] || type;
  }
  const kind = kindOf(type);
  if (!kind) return `This file type (${type || 'unknown'}) isn't supported. Supported: video, image, audio, PDF, Google Docs / Sheets / Slides.`;
  const len = Number(res.headers.get('content-length')) || 0;
  const max = LINK_MAX[kind];
  if (len > max) return `The file is too big (${mb(len)}; up to ${mb(max)} for ${kind}).`;
  const id = newId(16);
  const storedType = kind === 'doc' && type !== 'application/pdf' ? 'text/plain' : type;
  const size = await store(env.FILES, `files/${id}`, res, len, max, storedType);
  if (!size) return `The file is too big (up to ${mb(max)} for ${kind}).`;
  const rec = await addFile(storage, { id, kind, name, type: storedType, size, conv: 'link' });
  made.push({ id, kind, name: rec.name, size });
  return `Imported as [file ${id}: ${kind === 'doc' ? 'document' : kind} "${rec.name}"] (${mb(size) === '0MB' ? '<1MB' : mb(size)}). It is in the chat now – use it like an upload${kind === 'doc' ? ' (read it with read_file)' : ''}.`;
}
