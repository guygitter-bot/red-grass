import { useEffect, useState } from 'react';

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // אחסון מלא או חסום - האפליקציה ממשיכה לעבוד בזיכרון
  }
}

export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => loadJson(key, typeof initial === 'function' ? initial() : initial));
  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);
  return [value, setValue];
}
