// מקור התמונות: בטלפון – התוסף Gallery (mobile/android/.../GalleryPlugin.java); בדפדפן – גלריה לדוגמה
import { Capacitor, registerPlugin } from '@capacitor/core';
import * as demo from './demo.js';

export const isNative = Capacitor.isNativePlatform();
const Gallery = isNative ? registerPlugin('Gallery') : null;

export async function access() {
  if (!isNative) return { granted: true, canTrash: true, demo: true };
  return Gallery.access();
}

export async function list() {
  if (!isNative) return demo.list();
  const { items } = await Gallery.list();
  return (items || []).filter((p) => !p.mime || p.mime.startsWith('image/'));
}

// ניתוח בקבוצות קטנות, עם התקדמות. onBatch מקבל את התוצאות של כל קבוצה
export async function analyze(ids, onBatch, { batch = 24, labels = true, signal } = {}) {
  for (let i = 0; i < ids.length; i += batch) {
    if (signal?.aborted) return;
    const part = ids.slice(i, i + batch);
    const items = isNative ? (await Gallery.analyze({ ids: part, labels })).items || [] : await demo.analyze(part);
    onBatch(items, Math.min(ids.length, i + batch));
  }
}

// תמונות מוקטנות: מטמון בזיכרון + לכל היותר 4 בקשות בו־זמנית
const cache = new Map();
const MAX_CACHE = 600;
let active = 0;
const queue = [];

function pump() {
  while (active < 4 && queue.length) {
    const job = queue.pop(); // האחרונה שהתבקשה קודם – זו שעל המסך עכשיו
    active++;
    const run = isNative ? Gallery.thumb({ id: job.id, size: job.size }).then((r) => r.src) : demo.thumb(job.id, job.size);
    run
      .then((src) => {
        cache.set(job.key, src);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
        job.resolve(src);
      })
      .catch(() => job.resolve(null))
      .finally(() => {
        active--;
        pump();
      });
  }
}

export function cachedThumb(id, size = 300) {
  return cache.get(`${id}:${size}`) || null;
}

export function thumb(id, size = 300) {
  const key = `${id}:${size}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => {
    queue.push({ id, size, key, resolve });
    pump();
  });
}

export async function open(id) {
  if (isNative) await Gallery.open({ id });
}

// העברה לפח. בטלפון – אנדרואיד מציג חלון אישור משלו. מחזיר true אם אושר
export async function trash(ids) {
  if (!isNative) return demo.trash(ids);
  const { done } = await Gallery.trash({ ids });
  return !!done;
}
