// קריאת קישור: כותרת, תיאור וטקסט הדף – החומר שהסוכן ממפה לקטגוריה.
// דף שחוסם או ריק (רשתות חברתיות, אתרים עם JavaScript בלבד) – הסוכן קורא אותו בעצמו (web_fetch).
import { isPublicUrl, safeFetch } from './net.js';

export const MAX_TEXT = 15000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim();

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? clean(tag.match(/content=["']([^"']*)["']/i)?.[1]) : '';
}

// HTML -> { title, description, site, text }
export function readPage(html) {
  const title = meta(html, 'og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = meta(html, 'og:description') || meta(html, 'description');
  const site = meta(html, 'og:site_name');
  const body = html
    .replace(/<(head|title|script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h\d|tr|section|article|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(body)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1)
    .join('\n')
    .slice(0, MAX_TEXT);
  return { title, description, site, text };
}

// מוריד את הדף. לא נכשל: בלי חומר מחזיר רק את הכתובת (והסוכן ינסה לבד)
export async function gatherLink(url, fetchFn = fetch) {
  if (!isPublicUrl(url)) throw new Error('כתובת לא תקינה');
  try {
    const { res, finalUrl, text } = await safeFetch(fetchFn, url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AiMaagar/1.0)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
    });
    if (!res.ok) return { url, finalUrl, title: '', description: '', site: '', text: '' };
    const type = res.headers?.get?.('content-type') || '';
    if (/text\/plain|markdown/.test(type)) return { url, finalUrl, title: '', description: '', site: '', text: (await text()).slice(0, MAX_TEXT) };
    if (!/html/.test(type)) return { url, finalUrl, title: '', description: '', site: '', text: '' };
    return { url, finalUrl, ...readPage(await text()) };
  } catch {
    return { url, finalUrl: url, title: '', description: '', site: '', text: '' };
  }
}

// יש מספיק חומר כדי למפות בלי לקרוא את הדף שוב?
export const enoughText = (src) => `${src.title} ${src.description} ${src.text}`.trim().length >= 400;
