// חישובים לתובנות – פונקציות טהורות
import { nightKey, shiftNight, isMorning } from './night';
import { KINDS } from './kinds';

// לילות עם חלום שנרשם (לא "לא זכרתי")
function dreamNights(entries) {
  return new Set(entries.filter((e) => e.type === 'dream' && e.text.trim()).map((e) => e.night));
}

// כמה מ-N הלילות האחרונים נזכר בהם חלום. בבוקר – כולל הלילה שעבר; בערב ובלילה – מהלילה הקודם (הנוכחי עוד לא נגמר)
export function recallRate(entries, days = 14, now = new Date()) {
  const got = dreamNights(entries);
  const last = isMorning(now) ? nightKey(now) : shiftNight(nightKey(now), -1);
  let hit = 0;
  for (let i = 0; i < days; i += 1) if (got.has(shiftNight(last, -i))) hit += 1;
  return { hit, days };
}

// רצף לילות ברציפות עם רישום (חלום או "לא זכרתי") – כולל הלילה הנוכחי אם כבר נרשם
export function streak(entries, now = new Date()) {
  const logged = new Set(entries.map((e) => e.night));
  let k = nightKey(now);
  if (!logged.has(k)) k = shiftNight(k, -1);
  let n = 0;
  while (logged.has(k)) {
    n += 1;
    k = shiftNight(k, -1);
  }
  return n;
}

// הצלחת זימון: מכל הלילות עם כוונה ורישום – כמה הביאו חלום קשור (כן / חלקית)
export function incubation(nights, entries) {
  const byNight = new Map();
  for (const e of entries) {
    if (e.type !== 'dream') continue;
    const prev = byNight.get(e.night);
    const rank = { yes: 2, partly: 1, no: 0 };
    if (!prev || (rank[e.related] ?? -1) > (rank[prev] ?? -1)) byNight.set(e.night, e.related);
  }
  const loggedNights = new Set(entries.map((e) => e.night));
  const rows = KINDS.filter((k) => k.id !== 'recall').map((k) => ({ kind: k.id, tried: 0, yes: 0, partly: 0 }));
  const total = { tried: 0, yes: 0, partly: 0 };
  for (const [key, i] of Object.entries(nights)) {
    if (i.kind === 'recall' || !loggedNights.has(key)) continue;
    const row = rows.find((r) => r.kind === i.kind);
    const r = byNight.get(key);
    for (const t of [row, total]) {
      t.tried += 1;
      if (r === 'yes') t.yes += 1;
      if (r === 'partly') t.partly += 1;
    }
  }
  return { total, rows: rows.filter((r) => r.tried > 0) };
}

// תגיות וסמלים חוזרים
export function topTags(entries, n = 8) {
  const count = new Map();
  for (const e of entries) for (const t of e.tags) count.set(t, (count.get(t) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he')).slice(0, n);
}

// חיפוש ביומן: בטקסט, בכותרת, בתשובה ובתגיות
export function searchEntries(entries, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return entries;
  return entries.filter((e) =>
    [e.title, e.text, e.answer, ...e.tags, ...e.glimpses].some((x) => x.toLowerCase().includes(s)),
  );
}
