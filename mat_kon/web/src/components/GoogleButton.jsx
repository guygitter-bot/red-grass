import { useEffect, useRef, useState } from 'react';

// כפתור "המשך עם Google" (Google Identity Services). מחזיר את טוקן הכניסה, והשרת מאמת אותו
let loading;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      loading = null;
      reject(new Error('לא הצלחתי לטעון את הכניסה עם גוגל'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export default function GoogleButton({ clientId, text = 'continue_with', onCredential, onError }) {
  const box = useRef(null);
  const [width, setWidth] = useState(0);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    setWidth(Math.min(400, Math.round(box.current?.offsetWidth || 300)));
  }, []);

  useEffect(() => {
    if (!clientId || !width) return;
    let alive = true;
    loadGoogle()
      .then(() => {
        if (!alive || !box.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential), ux_mode: 'popup' });
        window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', shape: 'pill', text, locale: 'he', width });
      })
      .catch((e) => onError?.(e.message));
    return () => {
      alive = false;
    };
  }, [clientId, text, width]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="w-full flex justify-center min-h-11" />;
}
