// שמירה אוטומטית של טופס הקליטה: דחייה של ~800ms אחרי ההקלדה האחרונה, וטיוטה מקומית
// שמגינה על טקסט שעוד לא נשמר (רענון באמצע). הטיוטה נמחקת רק אחרי שמירה מוצלחת.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { buildSavePayload, clearDraft, pickInitial, readDraft, writeDraft } from './intake';

export const SAVE_DELAY_MS = 800;
const RETRY_MS = 5000;

// status: idle | dirty | saving | saved | error
export function useIntakeSave(clientId, serverIntake, serverUpdatedAt) {
  const [init] = useState(() => pickInitial(serverIntake, serverUpdatedAt, readDraft(clientId)));
  const [intake, setIntake] = useState(init.intake);
  const [status, setStatus] = useState(init.fromDraft ? 'dirty' : 'idle');
  const latest = useRef(init.intake);
  const version = useRef(0); // עולה בכל שינוי – כדי לדעת אם נוסף משהו בזמן שמירה
  const dirty = useRef(init.fromDraft);
  const saving = useRef(false);
  const timer = useRef(null);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || saving.current) return;
    const sent = version.current;
    saving.current = true;
    setStatus('saving');
    try {
      await api('PUT', `/clients/${clientId}`, buildSavePayload(latest.current));
      saving.current = false;
      if (version.current === sent) {
        dirty.current = false;
        clearDraft(clientId);
        setStatus('saved');
      } else {
        // הוקלד עוד משהו בזמן השמירה – שומרים שוב
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
      }
    } catch {
      saving.current = false;
      setStatus('error');
      timer.current = setTimeout(flush, RETRY_MS);
    }
  }, [clientId]);

  // שינוי בטופס: מקבל פונקציה מעותק ישן לעותק חדש
  const change = useCallback(
    (fn) => {
      const next = fn(latest.current);
      latest.current = next;
      version.current += 1;
      dirty.current = true;
      setIntake(next);
      setStatus('dirty');
      writeDraft(clientId, next);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [clientId, flush],
  );

  useEffect(() => {
    if (init.fromDraft) timer.current = setTimeout(flush, SAVE_DELAY_MS);
    else clearDraft(clientId);
    // יציאה מהמסך באמצע: שומרים מיד מה שנשאר
    return () => {
      flush();
    };
  }, [clientId, flush, init.fromDraft]);

  return { intake, change, status };
}
