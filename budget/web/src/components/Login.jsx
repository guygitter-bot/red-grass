// כניסה בסיסמה. בפעם הראשונה בכלל – קובעים סיסמה (היא תשמש בכל המכשירים)
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { login } from '../lib/store';
import { Button, inputCls } from './ui';

export default function Login() {
  const [ready, setReady] = useState(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/status')
      .then((r) => setReady(r.ready))
      .catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (ready === false && password !== again) {
      setError('הסיסמאות לא זהות');
      return;
    }
    setBusy(true);
    try {
      await login(ready ? '/login' : '/setup', password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="rounded-2xl bg-soft p-3 text-accent-ink">
            <Wallet size={32} />
          </span>
          <h1 className="text-2xl font-bold">תקציב הבית</h1>
          <p className="text-sm text-muted">{ready === false ? 'פעם ראשונה – בוחרים סיסמה. היא תשמש בטלפון ובמחשב.' : 'כניסה עם הסיסמה'}</p>
        </div>
        <input
          type="password"
          className={`${inputCls} mb-3`}
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete={ready === false ? 'new-password' : 'current-password'}
        />
        {ready === false && (
          <input type="password" className={`${inputCls} mb-3`} placeholder="שוב את אותה סיסמה" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        )}
        {error && <p className="mb-3 text-sm text-minus">{error}</p>}
        <Button className="w-full" disabled={busy || ready == null || password.length < 6}>
          {busy ? 'רגע…' : ready === false ? 'קביעת סיסמה וכניסה' : 'כניסה'}
        </Button>
        {ready === false && <p className="mt-2 text-center text-xs text-muted">לפחות 6 תווים</p>}
      </form>
    </div>
  );
}
