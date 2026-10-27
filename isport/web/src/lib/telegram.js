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

// נתיב שהייצוא מחזיר כשהקובץ לא הורד: "(File not included. Change data exporting settings to download.)" – זו לא תמונה
const realPath = (v) => typeof v === 'string' && v.trim() && !/^\(.*\)$/s.test(v.trim()) && !/^\(?File (not included|exceeds)/i.test(v.trim());

const photoOf = (m) => {
  if (realPath(m.photo)) return m.photo;
  if (realPath(m.file) && (String(m.mime_type || '').startsWith('image/') || IMAGE_FILE.test(m.file))) return m.file;
  return '';
};

const unix = (m) => Number(m.date_unixtime) || Math.floor(new Date(m.date).getTime() / 1000) || 0;

// הודעות -> פוסטים. בייצוא של Telegram Desktop אלבום = כמה הודעות רצופות באותה שנייה (או הפרש של שנייה),
// והטקסט (הכיתוב) באחת מהן – בדרך כלל בראשונה, לפעמים באחרונה.
// כלל הקיבוץ: רצף הודעות עם הפרש של עד 2 שניות בין כל שתיים הוא "גל". בתוך גל:
//   - טקסט שמגיע אחרי תמונות בלי טקסט -> הכיתוב של האלבום שלפניו (כיתוב בסוף);
//   - טקסט בלי תמונות ממתינות, עם תמונה משלו -> פותח אלבום, ותמונות בלי טקסט אחריו שייכות לו (כיתוב בהתחלה);
//   - כל טקסט חדש סוגר את הקודם, כך ששני אלבומים רצופים עם כיתוב לכל אחד נשארים שני מוצרים נפרדים;
//   - תמונות בלי טקסט בסוף הגל (בלי כיתוב) לא נדבקות לפוסט אחר.
// אם בייצוא יש מזהה אלבום (grouped_id) – הוא קובע לבדו.
export function readExport(json) {
  const msgs = (Array.isArray(json?.messages) ? json.messages : []).filter((m) => m?.type === 'message');
  const items = msgs.map((m) => {
    const { text, links } = flatten(m.text);
    return {
      id: m.id, date: m.date, t: unix(m), text, links: [...links, ...(text.match(URL_RE) || [])],
      photo: photoOf(m), group: m.grouped_id || m.media_group_id || null,
    };
  });
  const waves = [];
  for (const it of items) {
    const last = waves.at(-1);
    const prev = last?.at(-1);
    const same = prev && (it.group || prev.group ? it.group === prev.group : Math.abs(it.t - prev.t) <= 2);
    if (same) last.push(it);
    else waves.push([it]);
  }
  const posts = [];
  const open = (m, photos = []) => ({ id: m.id, t: m.t, date: m.date, text: m.text, links: [...m.links], photos: [...photos] });
  for (const wave of waves) {
    if (wave[0].group) {
      const withText = wave.find((m) => m.text.trim()) || wave[0];
      const post = open(wave[0]);
      post.text = withText.text;
      post.links = wave.flatMap((m) => m.links);
      for (const m of wave) {
        if (m.photo) post.photos.push(m.photo);
      }
      posts.push(post);
      continue;
    }
    let pending = [];
    let cur = null;
    for (const m of wave) {
      if (m.text.trim()) {
        const post = open(pending[0] || m, pending.map((p) => p.photo));
        post.text = m.text;
        post.links = [...m.links];
        if (m.photo) post.photos.push(m.photo);
        posts.push(post);
        cur = !pending.length && m.photo ? post : null;
        pending = [];
      } else if (cur) {
        if (m.photo) cur.photos.push(m.photo);
      } else if (m.photo) pending.push(m);
    }
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

// קישור FlyLinking = שם המארח flylinking.com או תת-דומיין שלו (לא סתם טקסט שמכיל את השם)
function isFlyLink(l) {
  try {
    const h = new URL(l).hostname.toLowerCase();
    return h === 'flylinking.com' || h.endsWith('.flylinking.com');
  } catch {
    return false;
  }
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
      // בלי ספרה (שנה) זה לא קוד מוצר – למשל שם כמו Paris-Saint-Germain
      if (!/\d/.test(code)) continue;
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
  const flyLink = post.links.find(isFlyLink) || '';
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
