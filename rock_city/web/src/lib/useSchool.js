import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken, setToken } from './api';

// כל הנתונים מהשרת. מתעדכן כל 20 שניות, כשחוזרים לאפליקציה, ואחרי כל שינוי
const POLL_MS = 20000;

export function useSchool() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [token, setTok] = useState(getToken);
  const v = useRef(null);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await api('/state', { v: v.current });
      setError('');
      if (res.same) return;
      v.current = res.v;
      setData(res);
    } catch (e) {
      if (e.status === 401) {
        setToken('');
        setTok('');
        setData(null);
        v.current = null;
      } else setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onFocus = () => {
      refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [token, refresh]);

  // פעולה בשרת ואז רענון
  const act = useCallback(
    async (path, body) => {
      const res = await api(path, body);
      await refresh();
      return res;
    },
    [refresh],
  );

  const signIn = useCallback((t) => {
    setToken(t);
    v.current = null;
    setTok(t);
  }, []);

  const signOut = useCallback(async () => {
    await api('/logout').catch(() => {});
    setToken('');
    v.current = null;
    setData(null);
    setTok('');
  }, []);

  return { data, error, token, refresh, act, signIn, signOut };
}
