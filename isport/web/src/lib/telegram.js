// ייבוא מערוץ טלגרם: קורא את הייצוא של Telegram Desktop (result.json + תיקיית photos) והופך הודעות למוצרים.
//   readExport -> הודעות (פוסטים): טקסט, תאריך, תמונות (נתיב בתוך התיקייה), קישורים
//   postProducts -> מוצרים מפוסט: כל קוד מוצר = מוצר אחד (קוד עם -LongSleeve = גרסת שרוול ארוך של אותו קוד)

const URL_RE = /https?:\/\/[^\s)]+/g;
// קוד כמו BocaJuniors-H-27 או Messi-Tribute-27-LongSleeve
const CODE_RE = /\b[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+){1,6}\b/g;
const TYPES = { H: 'Home', HOME: 'Home', A: 'Away', AWAY: 'Away', T: 'Third', '3': 'Third', THIRD: 'Third', GK: 'GK', G: 'GK', K: 'GK' };
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

// הטקסט של הודעה בייצוא: מחרוזת, או רשימה של קטעים ({ type, text, href })
function flatten(text) {
  if (typeof text === 'string') return { text, links: [] };
  const parts = Array.isArray(text) ? text : [];
  const links = [];
  const out = parts
    .map((p) => {
      if (typeof p === 'string') return p;
      if (p?.href) links.push(p.href);
      if (p?.type === 'link') links.push(p.text);
      return p?.text || '';
    })
    .join('');
  return { text: out, links };
}

const photoOf = (m) => {
  if (typeof m.photo === 'string') return m.photo;
  if (typeof m.file === 'string' && (String(m.mime_type || '').startsWith('image/') || IMAGE_FILE.test(m.file))) return m.file;
  return '';
};

const unix = (m) => Number(m.date_unixtime) || Math.floor(new Date(m.date).getTime() / 1000) || 0;

// הודעות -> פוסטים. אלבום (כמה תמונות עם טקסט אחד) מגיע כמה הודעות רצופות באותה שנייה בערך
export function readExport(json) {
  const msgs = (Array.isArray(json?.messages) ? json.messages : []).filter((m) => m?.type === 'message');
  const posts = [];
  let cur = null;
  for (const m of msgs) {
    const { text, links } = flatten(m.text);
    const photo = photoOf(m);
    const t = unix(m);
    const group = m.grouped_id || m.media_group_id || null;
    const sameAlbum =
      cur &&
      (group ? cur.group === group : !cur.group && Math.abs(t - cur.t) <= 2) &&
      !(cur.text.trim() && text.trim());
    if (!sameAlbum) {
      cur = { id: m.id, t, date: m.date, group, text: '', links: [], photos: [] };
      posts.push(cur);
    }
    if (text.trim()) cur.text = text;
    cur.links.push(...links, ...(text.match(URL_RE) || []));
    if (photo) cur.photos.push(photo);
  }
  return posts
    .filter((p) => p.text.trim())
    .map((p) => ({ ...p, links: [...new Set(p.links.map((l) => l.replace(/[.,]+$/, '')))] }));
}

// "BocaJuniors" -> "Boca Juniors"
const words = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2');

// פירוש קוד: קבוצה-סוג-שנה (מה שאפשר)
export function parseCode(code) {
  const parts = code.split('-');
  const team = words(parts[0]);
  let type = '';
  let year = '';
  for (const p of parts.slice(1)) {
    if (/^\d{2}$/.test(p)) year = `20${p}`;
    else if (/^\d{4}$/.test(p)) year = p;
    else if (!type && p.toLowerCase() !== 'longsleeve') type = TYPES[p.toUpperCase()] || words(p);
  }
  return { team, type, year };
}

const cleanLine = (s) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();

// מוצרים מפוסט אחד
export function postProducts(post) {
  const text = post.text.replace(URL_RE, ' ');
  const lines = text.split('\n');
  const found = new Map();
  for (const line of lines) {
    for (const raw of line.match(CODE_RE) || []) {
      const long = /-LongSleeve$/i.test(raw);
      const code = raw.replace(/-LongSleeve$/i, '');
      if (!/\d/.test(code) && code.split('-').length < 3) continue;
      const item = found.get(code) || { code, longSleeve: false, colorHe: '', typeHint: '' };
      if (long) item.longSleeve = true;
      else {
        // שאר השורה: (Home) / (Away) וצבע בעברית
        const rest = line.replace(raw, ' ');
        const hint = (rest.match(/\(([A-Za-z ]+)\)/) || [])[1];
        if (hint) item.typeHint = hint.trim();
        const he = cleanLine(rest.replace(/\([^)]*\)/g, '').replace(/[A-Za-z0-9:.-]/g, ''));
        if (he && he.length <= 20) item.colorHe = he;
      }
      found.set(code, item);
    }
  }
  const flyLink = post.links.find((l) => /flylinking\.com/i.test(l)) || '';
  const otherLink = flyLink ? '' : post.links.find((l) => /^https?:/.test(l)) || '';
  const title = cleanLine(lines.find((l) => cleanLine(l)) || '').replace(/[-–:]+$/, '').trim();
  const sleeveText = /שרוול(ים)? ארוכ/.test(post.text);
  return [...found.values()].map((it) => {
    const parsed = parseCode(it.code);
    return {
      key: `${post.id}:${it.code}`,
      postId: post.id,
      date: post.date,
      code: it.code,
      team: parsed.team,
      type: it.typeHint ? TYPES[it.typeHint.toUpperCase()] || it.typeHint : parsed.type,
      year: parsed.year,
      colorHe: it.colorHe,
      longSleeve: it.longSleeve || (sleeveText && found.size === 1),
      flyLink,
      otherLink,
      title,
      photos: post.photos.slice(0, 4),
    };
  });
}

export const allProducts = (posts) => posts.flatMap(postProducts);
