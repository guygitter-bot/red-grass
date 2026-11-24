// ניווט לפי הכתובת אחרי # (עובד גם כשהאפליקציה מותקנת במסך הבית)
import { useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

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
