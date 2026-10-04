import { useCallback, useEffect, useRef, useState } from 'react';
import { idbGet, idbSet } from '../lib/idb';
import { loadJson } from '../lib/storage';

// כמו usePersistentState, אבל נשמר ב-IndexedDB (מקום גדול). ערך ישן מ-localStorage עובר אוטומטית.
export default function useIdbState(key, initial, clean = (v) => v) {
  const [value, setValue] = useState(() => clean(loadJson(key, initial)));
  const touched = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    idbGet(key)
      .then((stored) => {
        // אם כבר הגיעו נתונים מהשרת בינתיים – לא דורסים אותם בעותק הישן
        if (alive && stored !== undefined && !touched.current) setValue(clean(stored));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      idbSet(key, value)
        .then(() => {
          try {
            localStorage.removeItem(key);
          } catch {
            // אחסון חסום
          }
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer.current);
  }, [key, value]);

  const set = useCallback((next) => {
    touched.current = true;
    setValue(next);
  }, []);
  return [value, set];
}
