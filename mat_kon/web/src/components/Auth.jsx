import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { checkInvite, getAuthConfig, googleSignIn, login, register } from '../lib/api';
import GoogleButton from './GoogleButton';

// הרשמה מקישור הזמנה, או כניסה במכשיר נוסף
export default function Auth({ mode: initialMode, token, onDone }) {
  const [mode, setMode] = useState(initialMode);
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [googleId, setGoogleId] = useState('');

  useEffect(() => {
    getAuthConfig().then((c) => setGoogleId(c.googleClientId || '')).catch(() => {});
  }, []);

  const withGoogle = async (credential) => {
    setBusy(true);
    setError('');
    try {
      onDone(await googleSignIn(credential, mode === 'register' ? token : ''));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialMode !== 'register') return;
    checkInvite(token)
      .then((d) => {
        setInvite(d);
        if (d.used) {
          setMode('login');
          setError('כבר נרשמו עם הקישור הזה. היכנסו עם החשבון שנרשמתם בו.');
        } else if (d.name) setForm((f) => ({ ...f, name: d.name }));
      })
      .catch((e) => {
        setMode('login');
        setError(e.status === 404 ? 'קישור ההזמנה לא תקף. אם כבר נרשמתם, היכנסו כאן.' : e.message);
      });
  }, [initialMode, token]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = mode === 'register' ? await register({ token, ...form }) : await login(form.email, form.password);
      onDone(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-2xl border border-stone-200 py-3 px-3 outline-none focus:border-orange-400';
  const loadingInvite = mode === 'register' && !invite;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-orange-50 to-amber-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-6">
        <div className="text-center">
          <img src="icon.svg" alt="" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-3xl font-black text-stone-900" dir="ltr">mat-kon</h1>
          <p className="text-stone-500 mb-5">
            {mode === 'register' ? 'הוזמנתם לספר מתכונים משלכם. נרשמים פעם אחת ומתחילים.' : 'כניסה לספר המתכונים שלכם'}
          </p>
        </div>

        {loadingInvite ? (
          <Loader2 className="animate-spin mx-auto text-orange-500" />
        ) : (
          <div className="space-y-3">
            {googleId && (
              <>
                <GoogleButton clientId={googleId} text={mode === 'register' ? 'signup_with' : 'signin_with'} onCredential={withGoogle} onError={setError} />
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span className="flex-1 h-px bg-stone-200" />
                  או עם אימייל וסיסמה
                  <span className="flex-1 h-px bg-stone-200" />
                </div>
              </>
            )}
            {mode === 'register' && (
              <label className="block">
                <span className="text-sm font-medium text-stone-700">שם</span>
                <input value={form.name} onChange={set('name')} autoComplete="name" required className={field} />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium text-stone-700">אימייל</span>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required dir="ltr" className={field} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">סיסמה{mode === 'register' ? ' (לפחות 6 תווים)' : ''}</span>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 6 : undefined}
                required
                dir="ltr"
                className={field}
              />
            </label>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button disabled={busy} className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={18} className="animate-spin" />}
              {mode === 'register' ? 'הרשמה' : 'כניסה'}
            </button>
            {mode === 'register' && (
              <p className="text-xs text-stone-500 text-center">{invite?.freeLimit ?? 10} המתכונים הראשונים בחינם.</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
