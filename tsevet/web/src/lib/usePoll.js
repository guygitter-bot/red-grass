// רענון מחזורי: מושהה כשהלשונית מוסתרת, ורץ מיד כשחוזרים אליה
import { useEffect, useRef } from 'react';

export function usePoll(fn, ms) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) ref.current();
    };
    tick();
    const t = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
}
