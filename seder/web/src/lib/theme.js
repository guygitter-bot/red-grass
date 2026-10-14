// מצב לילה: נשמר בכל מכשיר בנפרד (לא מסתנכרן) – אפשר לילה בטלפון ויום במחשב
import { useSyncExternalStore } from 'react';

const KEY = 'seder_theme';
const EVENT = 'seder-theme';

// הצבע של שורת המערכת בטלפון (theme-color), לפי המצב
export const BAR_COLORS = { light: '#7c3aed', dark: '#131118' };

export const THEME_OPTIONS = [
  { value: 'auto', label: 'אוטומטי', emoji: '📱' },
  { value: 'light', label: 'יום', emoji: '☀️' },
  { value: 'dark', label: 'לילה', emoji: '🌙' },
];

export function normalizeTheme(value) {
  return THEME_OPTIONS.some((o) => o.value === value) ? value : 'auto';
}

// "אוטומטי" = כמו ההגדרה של הטלפון / המחשב
export function isDark(pref, systemDark) {
  const p = normalizeTheme(pref);
  return p === 'dark' || (p === 'auto' && !!systemDark);
}

// לחיצה על הירח/השמש בכותרת: עוברים למצב ההפוך ממה שרואים עכשיו
export function toggledTheme(pref, systemDark) {
  return isDark(pref, systemDark) ? 'light' : 'dark';
}

export function getTheme() {
  try {
    return normalizeTheme(localStorage.getItem(KEY));
  } catch {
    return 'auto';
  }
}

function systemQuery() {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}

export function systemDark() {
  return !!systemQuery()?.matches;
}

export function applyTheme(pref = getTheme()) {
  const dark = isDark(pref, systemDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? BAR_COLORS.dark : BAR_COLORS.light);
}

export function setTheme(pref) {
  try {
    localStorage.setItem(KEY, normalizeTheme(pref));
  } catch {
    // אין גישה לאחסון – המצב יחול רק עד הסגירה
  }
  applyTheme(normalizeTheme(pref));
  window.dispatchEvent(new Event(EVENT));
}

// מחילים פעם אחת בפתיחה, ומתעדכנים כשהטלפון עובר בעצמו בין יום ללילה
export function initTheme() {
  applyTheme();
  systemQuery()?.addEventListener?.('change', () => {
    applyTheme();
    window.dispatchEvent(new Event(EVENT));
  });
}

function subscribe(cb) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// לרכיבים: [ההגדרה, האם כרגע לילה]
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getTheme);
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'));
  return { pref, dark };
}
