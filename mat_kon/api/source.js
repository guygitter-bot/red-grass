// קריאת הקישור: אתר מתכונים רגיל או סרטון (YouTube, TikTok, Instagram, Facebook).
// מחזיר את כל מה שאפשר להוציא מהדף בלי AI: נתוני מתכון מובנים (schema.org), כותרת, תמונה,
// תיאור הסרטון, כתוביות וטקסט הדף. הסוכן משלים ומסדר מזה את המתכון.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const MAX_HTML = 3 * 1024 * 1024;
const MAX_TEXT = 40000;

export function normalizeUrl(input) {
  let text = String(input || '').trim();
  // שיתוף מאפליקציה מגיע לפעמים כטקסט עם הקישור בסוף ("מתכון מעולה! https://...")
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (match) text = match[0];
  else if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(text)) text = `https://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  // לא פונים לכתובות פנימיות
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) {
    return null;
  }
  for (const p of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|igsh$|igshid$|si$|feature$)/i.test(p)) url.searchParams.delete(p);
  }
  url.hash = '';
  return url.toString();
}

export function youtubeId(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (u.searchParams.get('v')) return u.searchParams.get('v');
  const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
  return m ? m[1] : null;
}

export function sourceKind(url) {
  const host = new URL(url).hostname.replace(/^(www\.|m\.|vm\.|vt\.)/, '');
  if (youtubeId(url)) return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com') return 'instagram';
  if (host === 'facebook.com' || host === 'fb.watch') return 'facebook';
  if (host === 'vimeo.com') return 'vimeo';
  return 'page';
}

export const isVideoKind = (kind) => kind !== 'page';

// ---------- HTML ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

export function metaTags(html) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (name) => {
      const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
      return m ? (m[2] ?? m[3]) : null;
    };
    const key = (attr('property') || attr('name') || attr('itemprop') || '').toLowerCase();
    const content = attr('content');
    if (key && content != null && !(key in meta)) meta[key] = decodeEntities(content).trim();
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) meta['<title>'] = decodeEntities(title[1]).trim();
  return meta;
}

// מוצא את כל האובייקטים מסוג Recipe בתוך ה-JSON-LD של הדף (גם בתוך @graph ומערכים)
export function findJsonLdRecipes(html) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = node['@type'];
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) out.push(node);
    if (node['@graph']) visit(node['@graph']);
    if (node.mainEntity) visit(node.mainEntity);
  };
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      // JSON-LD שבור - מדלגים
    }
  }
  return out;
}

const asText = (v) => (typeof v === 'string' ? decodeEntities(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

function imageOf(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageOf(v[0]);
  return v.url || v.contentUrl || null;
}

function stepsOf(v) {
  if (!v) return [];
  if (typeof v === 'string') return [asText(v)].filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(stepsOf);
  if (v['@type'] === 'HowToSection') {
    return [`## ${asText(v.name)}`, ...stepsOf(v.itemListElement)];
  }
  return [asText(v.text || v.name)].filter(Boolean);
}

// מתכון schema.org בצורה קומפקטית שנשלחת לסוכן
export function compactRecipe(r) {
  return {
    name: asText(r.name),
    description: asText(r.description),
    image: imageOf(r.image),
    yield: Array.isArray(r.recipeYield) ? r.recipeYield.map(String).join(' / ') : r.recipeYield ?? null,
    prepTime: r.prepTime ?? null,
    cookTime: r.cookTime ?? null,
    totalTime: r.totalTime ?? null,
    category: r.recipeCategory ?? null,
    cuisine: r.recipeCuisine ?? null,
    ingredients: (r.recipeIngredient || r.ingredients || []).map(asText).filter(Boolean),
    instructions: stepsOf(r.recipeInstructions),
    video: r.video ? imageOf(r.video.contentUrl || r.video.embedUrl) : null,
  };
}

export function pageText(html) {
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|template|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|li|h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXT);
}

// ---------- YouTube ----------

// מוציא אובייקט JSON שמתחיל אחרי marker (למשל ytInitialPlayerResponse = {...})
export function jsonAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('{', at + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function captionsToText(data) {
  const lines = (data?.events || [])
    .map((e) => (e.segs || []).map((s) => s.utf8 || '').join('').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.join(' ').slice(0, MAX_TEXT);
}

function pickCaptionTrack(tracks) {
  if (!tracks?.length) return null;
  const by = (fn) => tracks.find(fn);
  return (
    by((t) => /^(he|iw)/.test(t.languageCode) && t.kind !== 'asr') ||
    by((t) => /^(he|iw)/.test(t.languageCode)) ||
    by((t) => t.kind !== 'asr') ||
    tracks[0]
  );
}

// ---------- איסוף ----------

async function get(fetchFn, url, accept = 'text/html') {
  const res = await fetchFn(url, {
    headers: {
      'user-agent': UA,
      accept,
      'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
      cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return { text: text.slice(0, MAX_HTML), finalUrl: res.url || url };
}

async function getJson(fetchFn, url) {
  try {
    return JSON.parse((await get(fetchFn, url, 'application/json')).text);
  } catch {
    return null;
  }
}

async function youtube(fetchFn, url, id, out) {
  out.embed = `https://www.youtube-nocookie.com/embed/${id}`;
  out.image = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const oembed = await getJson(fetchFn, `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
  if (oembed) {
    out.title = oembed.title || out.title;
    out.author = oembed.author_name || out.author;
  }
  try {
    const { text: html } = await get(fetchFn, `https://www.youtube.com/watch?v=${id}&hl=he`);
    const player = jsonAfter(html, 'ytInitialPlayerResponse');
    const details = player?.videoDetails;
    if (details) {
      out.title = details.title || out.title;
      out.author = details.author || out.author;
      out.description = details.shortDescription || '';
    }
    const track = pickCaptionTrack(player?.captions?.playerCaptionsTracklistRenderer?.captionTracks);
    if (track?.baseUrl) {
      const caps = await getJson(fetchFn, `${track.baseUrl}&fmt=json3`);
      const text = captionsToText(caps);
      if (text) out.transcript = text;
    }
  } catch (e) {
    out.warnings.push(`youtube page: ${e.message}`);
  }
}

// טוען את הקישור ומחזיר את החומר הגולמי למתכון. לא זורק שגיאה - מה שלא הצליח נרשם ב-warnings.
export async function gatherSource(url, fetchFn = fetch) {
  const kind = sourceKind(url);
  const out = {
    url,
    kind,
    title: '',
    author: '',
    siteName: '',
    image: null,
    embed: null,
    description: '',
    transcript: '',
    recipes: [],
    text: '',
    warnings: [],
  };

  if (kind === 'youtube') {
    await youtube(fetchFn, url, youtubeId(url), out);
    return out;
  }

  if (kind === 'tiktok') {
    const oembed = await getJson(fetchFn, `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (oembed) {
      out.title = oembed.title || '';
      out.description = oembed.title || '';
      out.author = oembed.author_name || '';
      out.image = oembed.thumbnail_url || null;
      const vid = String(oembed.html || '').match(/data-video-id="(\d+)"/);
      if (vid) out.embed = `https://www.tiktok.com/embed/v2/${vid[1]}`;
    }
  }

  try {
    const { text: html, finalUrl } = await get(fetchFn, url);
    const meta = metaTags(html);
    out.title = out.title || meta['og:title'] || meta['twitter:title'] || meta['<title>'] || '';
    out.siteName = meta['og:site_name'] || new URL(finalUrl).hostname.replace(/^www\./, '');
    out.image = out.image || meta['og:image'] || meta['twitter:image'] || null;
    const desc = meta['og:description'] || meta.description || '';
    if (desc.length > out.description.length) out.description = desc;
    out.recipes = findJsonLdRecipes(html).map(compactRecipe);
    if (!out.image && out.recipes[0]?.image) out.image = out.recipes[0].image;
    // בדף עם מתכון מובנה מלא אין צורך בכל טקסט הדף
    const full = out.recipes.some((r) => r.ingredients.length && r.instructions.length);
    out.text = full ? '' : pageText(html);
    if (kind === 'instagram') {
      const post = new URL(url).pathname.match(/\/(reel|reels|p|tv)\/([\w-]+)/);
      if (post) out.embed = `https://www.instagram.com/${post[1] === 'reels' ? 'reel' : post[1]}/${post[2]}/embed/captioned/`;
    }
    if (kind === 'vimeo') {
      const id = new URL(url).pathname.match(/\/(\d+)/);
      if (id) out.embed = `https://player.vimeo.com/video/${id[1]}`;
    }
  } catch (e) {
    out.warnings.push(`page: ${e.message}`);
  }
  if (out.image && !/^https?:\/\//i.test(out.image)) {
    try {
      out.image = new URL(out.image, url).toString();
    } catch {
      out.image = null;
    }
  }
  return out;
}

// האם יש מספיק חומר כדי לבנות מתכון בלי חיפוש ברשת
export function looksComplete(src) {
  return src.recipes.some((r) => r.ingredients.length >= 2 && r.instructions.length >= 1);
}
