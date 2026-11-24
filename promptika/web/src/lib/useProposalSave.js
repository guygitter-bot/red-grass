// שמירה אוטומטית של ההצעות: דחייה של ~800ms אחרי השינוי האחרון, ושליחת מערך ההצעות המלא
// (רק גרסה אחת השתנתה בו). status: idle | dirty | saving | saved | error
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export const SAVE_DELAY_MS = 800;
const RETRY_MS = 5000;

export function useProposalSave(clientId, initial) {
  const [proposals, setProposals] = useState(initial);
  const [status, setStatus] = useState('idle');
  const latest = useRef(initial);
  const version = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef(null);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || saving.current) return;
    const sent = version.current;
    saving.current = true;
    setStatus('saving');
    try {
      await api('PUT', `/clients/${clientId}`, { client: { proposals: latest.current } });
      saving.current = false;
      if (version.current === sent) {
        dirty.current = false;
        setStatus('saved');
      } else {
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
      }
    } catch {
      saving.current = false;
      setStatus('error');
      timer.current = setTimeout(flush, RETRY_MS);
    }
  }, [clientId]);

  // שינוי: מקבל פונקציה מרשימה ישנה לחדשה. immediate = שמירה מיד (למשל שכפול)
  const change = useCallback(
    (fn, immediate = false) => {
      const next = fn(latest.current);
      latest.current = next;
      version.current += 1;
      dirty.current = true;
      setProposals(next);
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, immediate ? 0 : SAVE_DELAY_MS);
    },
    [flush],
  );

  // יציאה מהמסך באמצע: שומרים מיד מה שנשאר
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return { proposals, change, status };
}
