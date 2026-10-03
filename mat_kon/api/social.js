// קריאה מעמיקה של רשתות חברתיות: הכיתוב של הפוסט והתגובות (תגובות של היוצר קודם),
// כי הרבה פעמים המתכון כתוב שם ולא בסרטון. הכל "best effort": מה שנחסם פשוט מדולג.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const MAX_COMMENTS = 60;
const IG_APP_ID = '936619743392459';
// לבוט של גוגל אינסטגרם מחזיר את הפוסט עם הכיתוב (לדפדפן רגיל/שרת – רק דף התחברות)
export const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
// מזהה השאילתה הציבורית של אינסטגרם לפוסט. אפשר להחליף בלי שינוי קוד (משתנה IG_DOC_ID ב-wrangler.toml).
export const IG_DOC_ID = '8845758582119845';

async function request(fetchFn, url, init = {}) {
  const res = await fetchFn(url, {
    ...init,
    headers: { 'user-agent': init.ua || UA, 'accept-language': 'he-IL,he;q=0.9,en;q=0.8', ...(init.headers || {}) },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const tryJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// מעבר על כל האובייקטים בתוך JSON (עם הגבלה, כדי לא להיתקע על תשובות ענקיות)
function walk(node, visit, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) return;
  if (visit(node) === false) return;
  for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v, visit, depth + 1);
}

function addComment(list, author, text, creator) {
  const t = String(text || '').trim();
  if (!t || list.some((c) => c.text === t)) return;
  list.push({ author: String(author || '').trim(), text: t, byCreator: Boolean(creator && author && author === creator) });
}

// התגובות של היוצר קודם, ואחריהן הארוכות (שם בדרך כלל המתכון)
export function sortComments(comments) {
  return [...comments]
    .sort((a, b) => Number(b.byCreator) - Number(a.byCreator) || b.text.length - a.text.length)
    .slice(0, MAX_COMMENTS);
}

// ---------- אינסטגרם ----------

export const instagramCode = (url) => (new URL(url).pathname.match(/\/(?:reel|reels|p|tv)\/([\w-]+)/) || [])[1] || null;

// מוציא כיתוב, יוצר, תמונה ותגובות מכל צורת JSON של אינסטגרם (GraphQL ישן/חדש, API פנימי, embed)
export function readInstagramJson(data, into) {
  walk(data, (node) => {
    const media = node.xdt_shortcode_media || node.shortcode_media;
    if (media && typeof media === 'object') {
      const owner = media.owner?.username || '';
      if (owner && !into.author) into.author = owner;
      const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text;
      if (caption && caption.length > into.caption.length) into.caption = caption;
      into.image = into.image || media.display_url || media.thumbnail_src || null;
      for (const key of ['edge_media_to_parent_comment', 'edge_media_to_comment', 'edge_media_preview_comment']) {
        for (const edge of media[key]?.edges || []) {
          const n = edge.node || {};
          addComment(into.comments, n.owner?.username, n.text, owner);
          for (const reply of n.edge_threaded_comments?.edges || []) {
            addComment(into.comments, reply.node?.owner?.username, reply.node?.text, owner);
          }
        }
      }
    }
    // API פנימי: items[0] עם caption.text, user.username, preview_comments
    if (node.caption && typeof node.caption === 'object' && typeof node.caption.text === 'string' && node.user?.username) {
      if (!into.author) into.author = node.user.username;
      if (node.caption.text.length > into.caption.length) into.caption = node.caption.text;
      for (const c of [...(node.preview_comments || []), ...(node.comments || [])]) {
        addComment(into.comments, c.user?.username, c.text, node.user.username);
      }
    }
    return true;
  });
  return into;
}

// דף ה-embed הציבורי: הכיתוב ב-HTML, ולפעמים JSON מלא ב-contextJSON
export function readInstagramEmbed(html, into) {
  const ctx = html.match(/"contextJSON":"((?:[^"\\]|\\.)*)"/);
  if (ctx) {
    const inner = tryJson(tryJson(`"${ctx[1]}"`) || '');
    if (inner) readInstagramJson(inner, into);
  }
  for (const marker of ['window.__additionalDataLoaded(', '"gql_data":']) {
    const at = html.indexOf(marker);
    if (at >= 0) {
      const start = html.indexOf('{', at);
      const json = start >= 0 ? balancedJson(html, start) : null;
      if (json) readInstagramJson(json, into);
    }
  }
  const caption = html.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/);
  if (caption) {
    const text = decode(caption[1].replace(/<a [^>]*class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
      .trim();
    if (text.length > into.caption.length) into.caption = text;
  }
  const user = html.match(/class="UsernameText"[^>]*>([^<]+)</);
  if (user && !into.author) into.author = decode(user[1]).trim();
  return into;
}

function balancedJson(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length && i < start + 3_000_000; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return tryJson(text.slice(start, i + 1));
  }
  return null;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s) =>
  String(s || '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENT[e.toLowerCase()] ?? all;
  });

// תווי כיווניות וטאבים שאינסטגרם מוסיף בתחילת הכיתוב
export const cleanCaption = (t) => String(t || '').replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/^[\s\t]+/, '').trim();

// JSON שמוטמע בדף כמחרוזת (\"key\":\"value\"): מורידים רמת escape אחת וקוראים את אובייקט הפוסט
export function readEscapedMedia(html, into) {
  for (const key of ['\\"xdt_shortcode_media\\"', '\\"shortcode_media\\"']) {
    const at = html.indexOf(key);
    if (at < 0) continue;
    const window = html.slice(at, at + 2_000_000).replace(/\\(["\\/])/g, '$1');
    const start = window.indexOf('{');
    const media = start >= 0 ? balancedJson(window, start) : null;
    if (media) {
      readInstagramJson({ shortcode_media: media }, into);
      return into;
    }
  }
  // לפחות הכיתוב
  const at = html.indexOf('\\"edge_media_to_caption\\"');
  if (at >= 0) {
    const window = html.slice(at, at + 200_000).replace(/\\(["\\/])/g, '$1');
    const m = window.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/);
    const text = m ? tryJson(`"${m[1]}"`) : null;
    if (text && text.length > into.caption.length) into.caption = text;
  }
  return into;
}

// og:description של אינסטגרם: '123 likes, 4 comments - user on March 1, 2026: "הכיתוב"'
export function captionFromOgDescription(desc) {
  const m = String(desc || '').replace(/[\u200e\u200f]/g, '').match(/:\s*["“]([\s\S]*?)["”]?\s*\.?\s*$/);
  return m ? cleanCaption(m[1]) : '';
}

export async function instagram(fetchFn, url, { docId = IG_DOC_ID } = {}) {
  const code = instagramCode(url);
  const into = { caption: '', author: '', image: null, comments: [], warnings: [], tried: [] };
  if (!code) return into;
  const attempts = [
    ['embed-googlebot', async () => {
      const html = await request(fetchFn, `https://www.instagram.com/p/${code}/embed/captioned/`, { ua: GOOGLEBOT });
      readEscapedMedia(html, into);
      readInstagramEmbed(html, into);
    }],
    ['page-googlebot', async () => {
      if (into.caption) return;
      // בדף עצמו יש גם כיתובים של פוסטים קשורים, לכן לוקחים רק את ה-og של הפוסט הזה
      const html = await request(fetchFn, `https://www.instagram.com/reel/${code}/`, { ua: GOOGLEBOT });
      const og = (name) => decode((html.match(new RegExp(`<meta[^>]+property="og:${name}"[^>]+content="([^"]*)"`)) || [])[1] || '');
      const caption = captionFromOgDescription(og('description'));
      if (caption.length > into.caption.length) into.caption = caption;
      into.image = into.image || og('image') || null;
      const user = og('url').match(/instagram\.com\/([\w.]+)\/(?:reel|p)\//);
      if (user && !into.author) into.author = user[1];
    }],
    ['embed', async () => {
      if (into.caption) return;
      readInstagramEmbed(await request(fetchFn, `https://www.instagram.com/p/${code}/embed/captioned/`), into);
    }],
    ['graphql', async () => {
      const body = new URLSearchParams({
        variables: JSON.stringify({ shortcode: code, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null }),
        doc_id: docId,
      });
      const text = await request(fetchFn, 'https://www.instagram.com/graphql/query', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-ig-app-id': IG_APP_ID,
          'x-fb-friendly-name': 'PolarisPostActionLoadPostQueryQuery',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://www.instagram.com',
          referer: `https://www.instagram.com/p/${code}/`,
        },
        body: body.toString(),
      });
      readInstagramJson(tryJson(text), into);
    }],
    ['graphql-legacy', async () => {
      const vars = encodeURIComponent(JSON.stringify({ shortcode: code, child_comment_count: 3, fetch_comment_count: 40, parent_comment_count: 24, has_threaded_comments: true }));
      const text = await request(fetchFn, `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${vars}`, {
        headers: { 'x-ig-app-id': IG_APP_ID, 'x-requested-with': 'XMLHttpRequest', accept: 'application/json' },
      });
      readInstagramJson(tryJson(text), into);
    }],
  ];
  for (const [name, run] of attempts) {
    try {
      const before = into.caption.length + into.comments.length;
      await run();
      into.tried.push(`${name}:${into.caption.length + into.comments.length > before ? 'ok' : 'empty'}`);
    } catch (e) {
      into.tried.push(`${name}:${e.message}`);
    }
    // יש כיתוב וגם תגובות - מספיק
    if (into.caption && into.comments.length >= 5) break;
  }
  into.caption = cleanCaption(into.caption);
  into.comments = sortComments(into.comments);
  return into;
}

// ---------- יוטיוב: תגובות ----------

export function youtubeCommentsToken(initialData) {
  let token = null;
  walk(initialData, (node) => {
    if (token) return false;
    const section = node.itemSectionRenderer;
    if (section && /comment/i.test(section.sectionIdentifier || '')) {
      walk(section, (n) => {
        if (!token && n.continuationCommand?.token) token = n.continuationCommand.token;
        return !token;
      });
    }
    const panel = node.engagementPanelSectionListRenderer;
    if (panel && /comment/i.test(panel.targetId || panel.panelIdentifier || '')) {
      walk(panel, (n) => {
        if (!token && n.continuationCommand?.token) token = n.continuationCommand.token;
        return !token;
      });
    }
    return true;
  });
  return token;
}

export function readYoutubeComments(data, creator) {
  const out = [];
  walk(data, (node) => {
    const entity = node.commentEntityPayload;
    if (entity) {
      const author = entity.author?.displayName || '';
      addComment(out, author, entity.properties?.content?.content, null);
      if (entity.author?.isCreator && out.length) out[out.length - 1].byCreator = true;
    }
    const legacy = node.commentRenderer;
    if (legacy) {
      const text = (legacy.contentText?.runs || []).map((r) => r.text).join('');
      addComment(out, legacy.authorText?.simpleText, text, null);
      if (legacy.authorIsChannelOwner && out.length) out[out.length - 1].byCreator = true;
    }
    return true;
  });
  for (const c of out) if (creator && c.author.replace(/^@/, '') === creator.replace(/^@/, '')) c.byCreator = true;
  return sortComments(out);
}

export async function youtubeComments(fetchFn, html, initialData, creator) {
  const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const version = (html.match(/"INNERTUBE_(?:CONTEXT_)?CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20260901.00.00';
  const token = youtubeCommentsToken(initialData);
  if (!token) return [];
  const text = await request(fetchFn, `https://www.youtube.com/youtubei/v1/next?prettyPrint=false${key ? `&key=${key}` : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://www.youtube.com' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: version, hl: 'he' } }, continuation: token }),
  });
  return readYoutubeComments(tryJson(text), creator);
}

// ---------- טיקטוק ----------

export function readTiktokPage(html) {
  const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  const data = m ? tryJson(m[1]) : null;
  const item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
  if (!item) return null;
  return { id: item.id, caption: item.desc || '', author: item.author?.uniqueId || '', image: item.video?.cover || null };
}

export async function tiktokComments(fetchFn, id, creator) {
  const text = await request(fetchFn, `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${id}&count=30&cursor=0`, {
    headers: { accept: 'application/json', referer: 'https://www.tiktok.com/' },
  });
  const out = [];
  for (const c of tryJson(text)?.comments || []) {
    addComment(out, c.user?.unique_id, c.text, creator);
    for (const r of c.reply_comment || []) addComment(out, r.user?.unique_id, r.text, creator);
  }
  return sortComments(out);
}

// ---------- קישורים בתוך כיתוב ותגובות ----------

const SOCIAL = /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|twitter\.com|x\.com|threads\.net|wa\.me|whatsapp\.com|linktr\.ee|t\.me)$/i;

// קישורים לאתרים (בלוג המתכונים של היוצר וכו') שכדאי לקרוא
export function linksIn(texts, limit = 3) {
  const out = [];
  for (const t of texts) {
    for (const raw of String(t || '').match(/(?:https?:\/\/|www\.)[^\s<>"'״)]+/gi) || []) {
      const url = (raw.startsWith('http') ? raw : `https://${raw}`).replace(/[.,!?;:]+$/, '');
      try {
        if (SOCIAL.test(new URL(url).hostname.replace(/^www\./, ''))) continue;
      } catch {
        continue;
      }
      if (!out.includes(url)) out.push(url);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ---------- פייסבוק ----------

// לבוט התצוגה המקדימה של פייסבוק עצמו מוחזר דף עם כותרת הפוסט (ולפעמים כל הטקסט), גם בקבוצות
export const FACEBOOK_BOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export function readFacebookPage(html) {
  const meta = (name) =>
    decode((html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`)) || [])[1] || '').trim();
  const title = meta('og:title').replace(/\s*\|\s*Facebook\s*$/i, '');
  // "שם הקבוצה | תחילת הפוסט.." או "שם | פוסט"
  const parts = title.split(' | ');
  const group = parts.length > 1 ? parts[0] : '';
  const start = parts.length > 1 ? parts.slice(1).join(' | ') : title;
  const texts = [meta('og:description'), meta('description'), start.replace(/\.\.+$/, '')];
  // טקסט הפוסט בתוך ה-HTML או ה-JSON של הדף
  for (const m of html.matchAll(/data-ad-(?:comet-)?preview="message"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)) {
    texts.push(decode(m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')));
  }
  for (const m of html.matchAll(/"message":\{(?:"__typename":"[^"]*",)?"text":"((?:[^"\\]|\\.)*)"/g)) {
    const t = tryJson(`"${m[1]}"`);
    if (t) texts.push(t);
  }
  const caption = texts.map((t) => String(t || '').trim()).sort((a, b) => b.length - a.length)[0] || '';
  return { caption, group, image: meta('og:image') || null, title: start };
}

export async function facebook(fetchFn, url) {
  const html = await request(fetchFn, url, { ua: FACEBOOK_BOT });
  return readFacebookPage(html);
}
