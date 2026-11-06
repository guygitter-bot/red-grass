// קיבוץ תמונות כפולות ודומות לפי טביעת האצבע (dHash של 64 סיביות, מחושב בטלפון).
// כפולות: כמעט זהות (גם אם צולמו/נשמרו בזמנים שונים, למשל אותה תמונה מוואטסאפ פעמיים).
// דומות: קרובות + צולמו בהפרש זמן קצר (רצף צילומים של אותו רגע).

export const DUP_DIST = 3;
export const SIMILAR_DIST = 11;
export const SIMILAR_WINDOW = 60 * 60 * 1000; // שעה

const POP = new Uint8Array(256).map((_, i) => {
  let c = 0;
  for (let v = i; v; v >>= 1) c += v & 1;
  return c;
});

// "abcd..." (16 תווים) → שני מספרים של 32 סיביות, כדי שההשוואה תהיה מהירה
export function parseHash(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{16}$/i.test(hex)) return null;
  return [parseInt(hex.slice(0, 8), 16) >>> 0, parseInt(hex.slice(8), 16) >>> 0];
}

function pop32(v) {
  return POP[v & 255] + POP[(v >>> 8) & 255] + POP[(v >>> 16) & 255] + POP[v >>> 24];
}

export function distance(a, b) {
  return pop32((a[0] ^ b[0]) >>> 0) + pop32((a[1] ^ b[1]) >>> 0);
}

export function hamming(hexA, hexB) {
  const a = parseHash(hexA);
  const b = parseHash(hexB);
  return a && b ? distance(a, b) : 64;
}

// תמונה "טובה" יותר בקבוצה: חדה יותר, גדולה יותר, לא חשוכה, מועדפת
export function score(photo, feat) {
  const sharp = Math.log10(1 + (feat?.sharp || 0)) * 10;
  const px = Math.log10(1 + (photo.w || 0) * (photo.h || 0));
  const b = feat?.bright ?? 128;
  const light = b < 40 ? -8 : b > 235 ? -4 : 0;
  return sharp + px + light + (photo.fav ? 100 : 0);
}

// photos: [{id, date, ...}], feats: {id: {hash, sharp, bright}}
// מחזיר [{kind: 'dup'|'similar', ids: [הכי טובה קודם], size}]
export function groupPhotos(photos, feats, opts = {}) {
  const dupDist = opts.dupDist ?? DUP_DIST;
  const simDist = opts.similarDist ?? SIMILAR_DIST;
  const windowMs = opts.windowMs ?? SIMILAR_WINDOW;
  const list = [];
  for (const p of photos) {
    const h = parseHash(feats[p.id]?.hash);
    // תמונה כמעט אחידה (שחור/לבן מלא) – לא להשוות, אחרת הכול "דומה"
    if (h && !(h[0] === 0 && h[1] === 0)) list.push({ p, h });
  }
  list.sort((a, b) => (a.p.date || 0) - (b.p.date || 0));
  const n = list.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const pairDup = new Set();
  // השוואת כל הזוגות (4,000 תמונות ≈ 8 מיליון השוואות מהירות). מעל 12,000 – כפולות רק באותו טווח זמן
  const allPairs = n <= 12000;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const near = (list[j].p.date || 0) - (list[i].p.date || 0) <= windowMs;
      if (!near && !allPairs) break;
      const d = distance(list[i].h, list[j].h);
      if (d <= dupDist) {
        union(i, j);
        pairDup.add(i + ':' + j);
      } else if (near && d <= simDist) {
        union(i, j);
      }
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  const out = [];
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    // כפולות = כל הזוגות בקבוצה כמעט זהים
    let allDup = true;
    for (let a = 0; a < idx.length && allDup; a++) {
      for (let b = a + 1; b < idx.length; b++) {
        const [x, y] = idx[a] < idx[b] ? [idx[a], idx[b]] : [idx[b], idx[a]];
        if (!pairDup.has(x + ':' + y)) {
          allDup = false;
          break;
        }
      }
    }
    const ps = idx.map((i) => list[i].p);
    ps.sort((a, b) => score(b, feats[b.id]) - score(a, feats[a.id]) || (b.size || 0) - (a.size || 0));
    out.push({
      kind: allDup ? 'dup' : 'similar',
      ids: ps.map((p) => p.id),
      date: Math.max(...ps.map((p) => p.date || 0)),
      // כמה מקום יתפנה אם משאירים רק את הטובה
      save: ps.slice(1).reduce((s, p) => s + (p.size || 0), 0),
    });
  }
  out.sort((a, b) => b.date - a.date);
  return out;
}
