// הצעות ניקוי: אילו תמונות כנראה אפשר למחוק. תמיד רק הצעה – המשתמשת מאשרת, והמחיקה עוברת לפח (30 יום)
import { groupPhotos } from './similar.js';
import { sourceOf, topicOf } from './categories.js';

const DAY = 24 * 60 * 60 * 1000;

export const KINDS = [
  { key: 'dup', label: 'תמונות כפולות', icon: '👯', desc: 'אותה תמונה כמה פעמים – משאירים אחת' },
  { key: 'similar', label: 'תמונות דומות', icon: '🎞️', desc: 'רצף צילומים של אותו רגע – משאירים את הטובה' },
  { key: 'blurry', label: 'מטושטשות', icon: '🌫️', desc: 'תמונות לא חדות' },
  { key: 'dark', label: 'חשוכות', icon: '🌑', desc: 'כמעט שחורות – צולמו בטעות' },
  { key: 'screenshots', label: 'צילומי מסך ישנים', icon: '📱', desc: 'צילומי מסך מלפני יותר מחודש' },
  { key: 'whatsapp', label: 'מוואטסאפ, ישנות', icon: '💬', desc: 'תמונות שקיבלת בוואטסאפ לפני יותר מ-3 חודשים' },
  { key: 'big', label: 'הכי כבדות', icon: '🐘', desc: 'התמונות שתופסות הכי הרבה מקום' },
];

// סף טשטוש יחסי לגלריה: נמוך מאוד ביחס לחציון (כל טלפון/מצלמה שונים)
export function blurThreshold(values) {
  const v = values.filter((x) => typeof x === 'number' && x >= 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const median = v[Math.floor(v.length / 2)];
  return Math.max(12, Math.min(80, median * 0.18));
}

export function analyzeAll(photos, feats, { now = Date.now(), kept = new Set() } = {}) {
  const groups = groupPhotos(photos, feats);
  const live = photos.filter((p) => !kept.has(p.id));
  const thr = blurThreshold(photos.map((p) => feats[p.id]?.sharp));
  const lists = { blurry: [], dark: [], screenshots: [], whatsapp: [], big: [] };
  const bySource = {};
  const byTopic = {};
  for (const p of photos) {
    const f = feats[p.id];
    const src = sourceOf(p);
    (bySource[src] ||= []).push(p.id);
    if (f) (byTopic[topicOf(p, f)] ||= []).push(p.id);
  }
  for (const p of live) {
    if (p.fav) continue; // מועדפות לא מוצעות למחיקה
    const f = feats[p.id];
    const src = sourceOf(p);
    const age = now - (p.date || now);
    if (f && !f.err) {
      if (typeof f.bright === 'number' && f.bright < 28) lists.dark.push(p.id);
      else if (src !== 'screenshot' && typeof f.sharp === 'number' && f.sharp < thr) lists.blurry.push(p.id);
    }
    if (src === 'screenshot' && age > 30 * DAY) lists.screenshots.push(p.id);
    if (src === 'whatsapp' && age > 90 * DAY) lists.whatsapp.push(p.id);
  }
  lists.big = [...live]
    .filter((p) => !p.fav)
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 60)
    .filter((p) => (p.size || 0) > 3 * 1024 * 1024)
    .map((p) => p.id);
  // קבוצה שהמשתמשת אמרה עליה "להשאיר את כולן" (כל התמונות שלה סומנו לשמירה) – לא מוצגת שוב
  const liveGroups = groups.filter((g) => !g.ids.every((id) => kept.has(id)));
  return {
    groups: liveGroups,
    dup: liveGroups.filter((g) => g.kind === 'dup'),
    similar: liveGroups.filter((g) => g.kind === 'similar'),
    lists,
    bySource,
    byTopic,
  };
}

// כמה מקום אפשר לפנות לפי כל ההצעות (כל תמונה נספרת פעם אחת)
export function potential(result, sizeOf) {
  const ids = new Set();
  for (const g of result.groups) g.ids.slice(1).forEach((id) => ids.add(id));
  for (const k of ['blurry', 'dark', 'screenshots']) result.lists[k].forEach((id) => ids.add(id));
  let bytes = 0;
  for (const id of ids) bytes += sizeOf(id);
  return { count: ids.size, bytes };
}
