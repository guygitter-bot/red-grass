import { useEffect, useRef, useState } from 'react';
import { isNative } from '../lib/native';

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

export default function GoogleButton(props) {
  // באפליקציה מהחנות הכפתור של הדפדפן לא עובד (גוגל חוסמת WebView) – שם הכניסה היא דרך חשבון הגוגל של הטלפון
  return isNative() ? <NativeGoogleButton {...props} /> : <WebGoogleButton {...props} />;
}

// כניסה מהטלפון (Credential Manager באנדרואיד). מחזיר אותו טוקן כמו הכפתור של הדפדפן, והשרת מאמת אותו באותה דרך
function NativeGoogleButton({ clientId, text = 'continue_with', onCredential, onError }) {
  const [busy, setBusy] = useState(false);
  const label = { signin_with: 'כניסה עם Google', signup_with: 'הרשמה עם Google' }[text] || 'המשך עם Google';
  const signIn = async () => {
    if (!clientId || busy) return;
    setBusy(true);
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      await SocialLogin.initialize({ google: { webClientId: clientId } });
      const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
      const token = res?.result?.idToken;
      if (!token) throw new Error('לא התקבל אישור מגוגל');
      await onCredential(token);
    } catch (e) {
      // ביטול על ידי המשתמש – בלי הודעת שגיאה
      if (!/cancel/i.test(String(e?.message || e))) onError?.(`הכניסה עם גוגל נכשלה: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="w-full max-w-[400px] mx-auto min-h-11 rounded-full border border-stone-300 bg-white text-stone-800 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {busy ? 'מתחבר…' : label}
    </button>
  );
}

function WebGoogleButton({ clientId, text = 'continue_with', onCredential, onError }) {
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
