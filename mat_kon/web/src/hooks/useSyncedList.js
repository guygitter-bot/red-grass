import { useCallback, useEffect, useMemo, useRef } from 'react';
import { applyOps, diffItems } from '../lib/sync';

// רשימה משותפת שנשמרת בשרת פריט-פריט.
//   value / setValue – המצב המקומי (נשמר גם במכשיר להצגה מהירה)
//   toItems / fromItems – המרה לרשימה שטוחה עם id (לתכנון: לפי ימים)
//   send(ops) -> Promise<value מהשרת>
// לפני שהרשימה נטענה מהשרת לא נשלח כלום, כדי שנתונים ישנים במכשיר לא ייכנסו לספר.
export default function useSyncedList({ value, setValue, toItems, fromItems, send, onError }) {
  const synced = useRef(null); // הרשימה כפי שהשרת מכיר אותה (רשימה שטוחה)
  const latest = useRef(value);
  const timer = useRef(null);
  const inflight = useRef(false);
  latest.current = value;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!synced.current || inflight.current) return;
    const sent = toItems(latest.current);
    const ops = diffItems(synced.current, sent);
    if (!ops.length) return;
    inflight.current = true;
    try {
      const server = toItems(await send(ops));
      synced.current = server;
      // שינויים שנעשו בזמן השליחה נשמרים מעל מה שהשרת החזיר, ויישלחו בסבב הבא
      const since = diffItems(sent, toItems(latest.current));
      latest.current = fromItems(applyOps(server, since));
      setValue(latest.current);
      if (since.length) timer.current = setTimeout(flush, 300);
    } catch (e) {
      onError?.(e);
    } finally {
      inflight.current = false;
    }
  }, [toItems, fromItems, send, setValue, onError]);

  // שינוי מקומי: מיד על המסך, ונשלח לשרת אחרי רגע
  const change = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(latest.current) : next;
      latest.current = resolved;
      setValue(resolved);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
    },
    [setValue, flush],
  );

  // הרשימה מהשרת (בטעינה, ובכל חזרה לאפליקציה): שינויים מקומיים שעוד לא נשלחו נשמרים מעליה
  const loaded = useCallback(
    (serverValue) => {
      const server = toItems(serverValue);
      const local = synced.current ? diffItems(synced.current, toItems(latest.current)) : [];
      synced.current = server;
      const merged = applyOps(server, local);
      latest.current = fromItems(merged);
      setValue(latest.current);
      if (local.length) timer.current = setTimeout(flush, 300);
    },
    [toItems, fromItems, setValue, flush],
  );

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    synced.current = null;
  }, []);

  // שמירה כשהאפליקציה נסגרת או עוברת לרקע
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  return useMemo(() => ({ change, loaded, reset, flush }), [change, loaded, reset, flush]);
}
