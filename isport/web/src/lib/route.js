// ניווט לפי הכתובת אחרי # (עובד גם כשהאפליקציה מותקנת במסך הבית)
import { useEffect, useState } from 'react';

// קישור שבור (למשל %E0) לא מפיל את האפליקציה – במקרה כזה נשאר הערך הגולמי
const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);

export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path) => {
  window.location.hash = `#/${path}`;
};
