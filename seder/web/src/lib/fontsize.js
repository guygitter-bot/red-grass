// גודל הטקסט: נשמר בכל מכשיר בנפרד (לא מסתנכרן) – אפשר טקסט גדול בטלפון ורגיל במחשב.
// כל הגדלים באפליקציה יחסיים לגודל של html (rem), ולכן מספיק לשנות משתנה אחד: --font-scale (ראו index.css)
import { useSyncExternalStore } from 'react';

const KEY = 'seder_font';
const EVENT = 'seder-font';

export const FONT_OPTIONS = [
  { value: 'normal', label: 'רגיל', scale: 1 },
  { value: 'large', label: 'גדול', scale: 1.125 },
  { value: 'xlarge', label: 'גדול מאוד', scale: 1.25 },
];

export function normalizeFont(value) {
  return FONT_OPTIONS.some((o) => o.value === value) ? value : 'normal';
}

export function fontScale(value) {
  return FONT_OPTIONS.find((o) => o.value === normalizeFont(value)).scale;
}

export function getFont() {
  try {
    return normalizeFont(localStorage.getItem(KEY));
  } catch {
    return 'normal';
  }
}

export function applyFont(value = getFont()) {
  document.documentElement.style.setProperty('--font-scale', String(fontScale(value)));
}

export function setFont(value) {
  try {
    localStorage.setItem(KEY, normalizeFont(value));
  } catch {
    // אין גישה לאחסון – הגודל יחול רק עד הסגירה
  }
  applyFont(normalizeFont(value));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useFont() {
  return useSyncExternalStore(subscribe, getFont);
}
