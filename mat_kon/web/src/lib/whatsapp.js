// ייבוא מווטסאפ: קריאת צ'אט מיוצא ("ייצוא צ'אט" → "ללא מדיה") ומציאת קישורים ומתכונים כתובים.
// הכל רץ בדפדפן; רק מה שבוחרים לייבא נשלח לשרת.
import { unzipSync, strFromU8 } from 'fflate';

// שורת פתיחה של הודעה:
//   אנדרואיד: 3.10.2026, 14:22 - דנה: טקסט      /  10/3/26, 2:22 PM - Dana: text
//   אייפון:   [3.10.2026, 14:22:05] דנה: טקסט
const LINE =
  /^[‎‏‪-‮]*\[?(\d{1,4}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:[\s ]?[APap]\.?\s?[Mm]\.?)?)\]?\s*[-–]?\s*(.*)$/;
const MEDIA = /^[‎]?(<.*(omitted|הושמט|מדיה).*>|.*(image|video|sticker|GIF|audio|document) omitted|null|This message was deleted|הודעה זו נמחקה)\s*$/i;

export function parseChat(text) {
  const messages = [];
  let current = null;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const m = raw.match(LINE);
    if (m) {
      const body = m[3];
      const sep = body.indexOf(': ');
      // הודעות מערכת (הצטרפות, הצפנה...) הן בלי "שם: "
      current = sep > 0 && sep < 60
        ? { date: m[1], time: m[2], author: body.slice(0, sep).replace(/[‎‏]/g, '').trim(), text: body.slice(sep + 2) }
        : null;
      if (current) messages.push(current);
    } else if (current) {
      current.text += `\n${raw}`;
    }
  }
  return messages
    .map((msg) => ({ ...msg, text: msg.text.replace(/[‎‏]/g, '').trim() }))
    .filter((msg) => msg.text && !MEDIA.test(msg.text));
}

// ---------- קישורים ----------

const URL_RE = /https?:\/\/[^\s<>"'״]+/gi;
const SKIP_HOSTS = /(^|\.)(chat\.whatsapp\.com|wa\.me|whatsapp\.com|waze\.com|zoom\.us|meet\.google\.com|maps\.app\.goo\.gl|calendar\.google\.com|docs\.google\.com|forms\.gle|paypal\.me|bit\.ly\/m\/)$/i;
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|vimeo\.com|pinterest\.com|pin\.it)$/i;
const FOOD_HOSTS = /(^|\.)(10dakot\.co\.il|foodis\.co\.il|bishulim\.co\.il|allrecipes\.com|seriouseats\.com|bbcgoodfood\.com|food52\.com|nytimes\.com|kitchencoach\.co\.il|ptitim\.co\.il|chef-lavan\.co\.il|carine\.co\.il|nikib\.co\.il|baking\.co\.il|foody\.co\.il|tasty\.co)$/i;
const RECIPE_PATH = /recipe|recipes|matkon|%D7%9E%D7%AA%D7%9B%D7%95%D7%9F|מתכון|food|cook|bake/i;

const trimUrl = (u) => u.replace(/[)\].,!?;:*_~]+$/, '');

// לזיהוי קישור שכבר נשמר: בלי פרמטרי מעקב, בלי # ובלי / בסוף
export function urlKey(url) {
  try {
    const u = new URL(url);
    // אותו סרטון ביוטיוב בכל הצורות (watch, youtu.be, shorts)
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    const yt = host === 'youtu.be'
      ? u.pathname.slice(1).split('/')[0]
      : host === 'youtube.com' && (u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1]);
    if (yt) return `youtube:${yt}`;
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|igsh$|igshid$|si$|feature$)/i.test(p)) u.searchParams.delete(p);
    }
    u.hash = '';
    return `${u.hostname.replace(/^(www|m)\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

// ---------- מתכונים כתובים ----------

const RECIPE_WORDS = [
  'מצרכים', 'מרכיבים', 'אופן הכנה', 'אופן ההכנה', 'הוראות הכנה', 'כוס', 'כוסות', 'כף', 'כפות', 'כפית', 'כפיות',
  'גרם', "גר'", 'ק"ג', 'מ"ל', 'ליטר', 'תנור', 'מעלות', 'מערבבים', 'לערבב', 'אופים', 'לאפות', 'מבשלים', 'לבשל',
  'מטגנים', 'לטגן', 'קמח', 'סוכר', 'ביצים', 'ביצה', 'שמן', 'מלח', 'חמאה', 'תבנית', 'סיר', 'מחבת',
  'ingredients', 'cup', 'cups', 'tbsp', 'tsp', 'oven', 'bake', 'flour', 'sugar',
];

export function recipeScore(text) {
  const t = String(text || '').toLowerCase();
  return RECIPE_WORDS.filter((w) => t.includes(w.toLowerCase())).length;
}

export const looksLikeRecipe = (text) => String(text || '').length >= 120 && recipeScore(text) >= 4;

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// מועמדים לייבוא: קישורים (פעם אחת כל קישור) ומתכונים שנכתבו כטקסט בצ'אט
export function findCandidates(messages, { existingUrls = [], existingKeys = [] } = {}) {
  const saved = new Set(existingUrls.filter(Boolean).map(urlKey));
  const savedText = new Set(existingKeys.filter(Boolean));
  const seen = new Map();
  const out = [];
  for (const msg of messages) {
    const urls = (msg.text.match(URL_RE) || []).map(trimUrl);
    for (const url of urls) {
      let host;
      try {
        host = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
      if (SKIP_HOSTS.test(host)) continue;
      const key = urlKey(url);
      if (seen.has(key)) {
        seen.get(key).shares += 1;
        continue;
      }
      const context = msg.text.replace(URL_RE, '').trim();
      const likely = VIDEO_HOSTS.test(host) || FOOD_HOSTS.test(host) || RECIPE_PATH.test(url) || recipeScore(context) >= 1 || /מתכון|recipe/i.test(context);
      const item = {
        id: `l:${key}`, type: 'link', url, host, context: context.slice(0, 200),
        author: msg.author, date: msg.date, shares: 1, saved: saved.has(key), likely,
      };
      seen.set(key, item);
      out.push(item);
    }
    const textOnly = msg.text.replace(URL_RE, '').trim();
    if (looksLikeRecipe(textOnly)) {
      const id = `wa:${hashText(textOnly)}`;
      if (!seen.has(id)) {
        const item = {
          id, type: 'text', text: textOnly, title: textOnly.split('\n')[0].slice(0, 80),
          author: msg.author, date: msg.date, saved: savedText.has(id), likely: true,
        };
        seen.set(id, item);
        out.push(item);
      }
    }
  }
  return out;
}

// ---------- קובץ ----------

// שם הצ'אט מתוך שם הקובץ: "WhatsApp Chat with X.txt", "צ'אט WhatsApp עם X.zip"
export function chatNameFromFile(name) {
  return String(name || '')
    .replace(/\.(txt|zip)$/i, '')
    .replace(/^(WhatsApp Chat( with|\s*-)?|צ['׳]אט WhatsApp עם|שיחת WhatsApp עם)\s*/i, '')
    .replace(/^_chat$/, '')
    .trim();
}

export async function readChatFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) return { name: chatNameFromFile(file.name), text: new TextDecoder().decode(bytes) };
  const files = unzipSync(bytes, { filter: (f) => /\.txt$/i.test(f.name) });
  const names = Object.keys(files);
  const pick = names.find((n) => /_chat\.txt$/i.test(n)) || names[0];
  if (!pick) throw new Error('בקובץ ה-zip אין צ\'אט. ייצאו שוב את הצ\'אט "ללא מדיה".');
  return { name: chatNameFromFile(file.name), text: strFromU8(files[pick]) };
}
