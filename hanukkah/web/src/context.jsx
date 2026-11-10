import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadProgress, saveProgress, safeProgress, totalStars } from './lib/progress';
import { BADGES, earnedBadges } from './lib/badges';
import { play } from './lib/sound';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [progress, setProgress] = useState(() => loadProgress());
  const ref = useRef(progress);
  const [toast, setToast] = useState(null);

  // עדכון התקדמות: fn מקבלת את המצב הנוכחי ומחזירה אובייקט חדש. תג חדש מקפיץ הודעה.
  const update = useCallback((fn) => {
    const before = earnedBadges(ref.current);
    const next = safeProgress(fn(ref.current));
    ref.current = next;
    setProgress(next);
    saveProgress(next);
    const fresh = earnedBadges(next).filter((id) => !before.includes(id));
    if (fresh.length) {
      const b = BADGES.find((x) => x.id === fresh[0]);
      setToast(`${b.icon} תג חדש: ${b.name}`);
      play('win');
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => {
      clearTimeout(t);
    };
  }, [toast]);

  return (
    <Ctx.Provider value={{ progress, update, stars: totalStars(progress), toast }}>{children}</Ctx.Provider>
  );
}
