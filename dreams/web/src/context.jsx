import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadData, saveData, safeData } from './lib/store';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [data, setData] = useState(() => loadData());
  const ref = useRef(data);
  const [toast, setToast] = useState(null);

  // עדכון: fn מקבלת את המצב ומחזירה חדש. נשמר מיד במכשיר.
  const update = useCallback((fn) => {
    const next = safeData(fn(ref.current));
    ref.current = next;
    setData(next);
    if (!saveData(next)) setToast('לא הצלחנו לשמור במכשיר. כדאי לשמור גיבוי בהגדרות.');
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => {
      setToast(null);
    }, 3200);
    return () => {
      clearTimeout(t);
    };
  }, [toast]);

  return <Ctx.Provider value={{ data, update, toast, setToast }}>{children}</Ctx.Provider>;
}
