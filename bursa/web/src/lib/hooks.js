// הוקים משותפים
import { useEffect, useRef, useState } from 'react';

// קורא ל-fn מיד ואחר כך כל ms, רק כשהלשונית גלויה (ובחזרה אליה מרענן מיד)
export function useLive(fn, ms, deps = []) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    let timer = null;
    const run = () => {
      Promise.resolve(ref.current()).catch(() => {});
    };
    const start = () => {
      run();
      timer = setInterval(run, ms);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (!timer) start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

// ערך שמתעדכן רק אחרי שהקלט נעצר
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setV(value), ms);
    return () => {
      clearTimeout(timer);
    };
  }, [value, ms]);
  return v;
}

// הודעה קצרה למשתמש (מוצגת ב-App)
export function toast(message) {
  window.dispatchEvent(new CustomEvent('bursa-toast', { detail: message }));
}
