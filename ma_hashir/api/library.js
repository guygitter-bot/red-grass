// איפה שומעים כל שיר: קטע של 30 שניות מ-iTunes (בלי מפתח), ואם לא נמצא – מ-Deezer.
// Durable Object אחד ("lib") שזוכר את מה שנמצא, כדי שכל שיר יחפשו פעם אחת בחודש ולא בכל משחק.
//
// אחסון:  s:<מזהה שיר> -> { src: 'it:<כתובת>' | 'dz:<מספר שיר ב-Deezer>' | null, art, at }
//   src = null: לא נמצא (מנסים שוב אחרי 3 ימים)
// ל-Deezer שומרים רק את מספר השיר: הכתובת שלהם מתחלפת, ולכן היא נלקחת מחדש בכל השמעה (worker.js, /audio).
import { compact, norm } from './game.js';

const FOUND_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_MS = 3 * 24 * 60 * 60 * 1000;
// לא יותר מזה פניות החוצה בבקשה אחת (מגבלה של Cloudflare); מה שלא הספקנו – בפעם הבאה
const MAX_LOOKUPS = 30;
const PARALLEL = 4;
const TIMEOUT_MS = 6000;

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// גרסאות שלא רוצים: קריוקי, כיסויים, גרסאות פסנתר...
const BAD = /karaoke|tribute|made famous|in the style of|originally performed|cover version|instrumental|lullaby|8-bit|ringtone|קריוקי|רינגטון/i;
const MEH = /\blive\b|remix|acoustic|version|edit\b|mix\b|לייב|הופעה|רמיקס/i;
const HEBREW = /[א-ת]/;

function artistMatch(found, wanted) {
  const a = compact(found);
  const b = compact(wanted);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = norm(wanted).split(' ').filter((w) => w.length >= 3 && !['the', 'and', 'להקת'].includes(w));
  const have = new Set(norm(found).split(' '));
  return words.length > 0 && words.filter((w) => have.has(w)).length * 2 >= words.length;
}

// התוצאה הכי מתאימה מתוך רשימה של {title, artist, album, preview}; או null
export function pickBest(results, song) {
  const want = compact(song.title);
  let best = null;
  let bestScore = 0;
  for (const r of results) {
    if (!r?.preview || BAD.test(`${r.title} ${r.artist} ${r.album || ''}`)) continue;
    const got = compact(r.title);
    if (!got || !want) continue;
    const exact = got === want;
    const partial = !exact && Math.min(got.length, want.length) >= 3 && (got.startsWith(want) || want.startsWith(got));
    if (!exact && !partial) continue;
    // זמר/ת ישראלי/ת שמופיע/ה באנגלית בחנות – אי אפשר להשוות את השם, אז רק שם שיר מדויק
    const unknown = HEBREW.test(song.artist) && !HEBREW.test(r.artist || '');
    const artist = artistMatch(r.artist, song.artist);
    if (!artist && !(unknown && exact)) continue;
    let score = (exact ? 4 : 2) + (artist ? 3 : 0);
    if (MEH.test(`${r.title} ${r.album || ''}`)) score -= 1;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

export class Library {
  constructor(state, env = {}) {
    this.storage = state.storage;
    this.env = env;
    this.now = env.NOW || (() => Date.now());
    this.fetcher = env.FETCH || ((...a) => fetch(...a));
  }

  async fetch(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'בקשה לא תקינה' });
    }
    const songs = (Array.isArray(body.songs) ? body.songs : []).slice(0, 100);
    return json(200, { found: await this.resolve(songs) });
  }

  // {מזהה: {src, art}} לכל שיר שנמצא
  async resolve(songs) {
    const now = this.now();
    const cached = songs.length ? await this.storage.get(songs.map((s) => `s:${s.id}`)) : new Map();
    const found = {};
    const todo = [];
    for (const s of songs) {
      const c = cached.get(`s:${s.id}`);
      if (c && now - c.at < (c.src ? FOUND_MS : MISS_MS)) {
        if (c.src) found[s.id] = { src: c.src, art: c.art || '' };
      } else todo.push(s);
    }
    this.budget = MAX_LOOKUPS;
    const queue = [...todo];
    const work = async () => {
      while (queue.length && this.budget > 0) {
        const s = queue.shift();
        let hit;
        try {
          hit = await this.lookup(s);
        } catch (e) {
          // תקלה ברשת – לא זוכרים כלום, ננסה בפעם הבאה
          console.log('lookup failed', s.title, e?.message || e);
          continue;
        }
        await this.storage.put(`s:${s.id}`, { src: hit?.src || null, art: hit?.art || '', at: now });
        if (hit) found[s.id] = hit;
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, work));
    return found;
  }

  async getJson(url) {
    this.budget--;
    const res = await this.fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json', 'user-agent': 'ma-hashir-game/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // מחפשים קודם ב-iTunes (ישראלי – בחנות הישראלית), ואם אין – ב-Deezer
  async lookup(song) {
    const term = encodeURIComponent(`${song.title} ${song.artist}`);
    let failed = null;
    try {
      const country = song.lang === 'il' ? 'IL' : 'US';
      const data = await this.getJson(`https://itunes.apple.com/search?term=${term}&country=${country}&media=music&entity=song&limit=15`);
      const best = pickBest(
        (data.results || []).map((r) => ({ title: r.trackName, artist: r.artistName, album: r.collectionName, preview: r.previewUrl, art: r.artworkUrl100 })),
        song,
      );
      if (best) return { src: `it:${best.preview}`, art: String(best.art || '').replace('100x100', '300x300') };
    } catch (e) {
      failed = e;
    }
    if (this.budget <= 0) {
      if (failed) throw failed;
      return null;
    }
    const data = await this.getJson(`https://api.deezer.com/search?q=${term}&limit=15`);
    const best = pickBest(
      (data.data || []).map((r) => ({ id: r.id, title: r.title, artist: r.artist?.name, album: r.album?.title, preview: r.preview, art: r.album?.cover_medium })),
      song,
    );
    return best ? { src: `dz:${best.id}`, art: best.art || '' } : null;
  }
}
