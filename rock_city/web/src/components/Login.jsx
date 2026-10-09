import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button, Input, Logo } from './ui';

// כניסה של המנהל. בפעם הראשונה (עוד אין מנהל) – יצירת שם משתמש וסיסמה
export default function Login({ onToken, linkFailed }) {
  const [ready, setReady] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/status')
      .then((r) => setReady(r.ready))
      .catch((e) => setError(e.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (ready === false && password !== again) {
      setError('הסיסמאות לא זהות');
      return;
    }
    setBusy(true);
    try {
      const res = await api(ready ? '/login' : '/setup', { username, password });
      onToken(res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shards grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-6 text-white shadow-2xl backdrop-blur">
        <Logo className="mx-auto h-32" />
        <h1 className="mt-4 text-center text-xl font-bold">מערכת השעות</h1>
        {linkFailed && <p className="mt-3 rounded-xl bg-red-500/20 p-3 text-center text-sm">הקישור כבר לא בתוקף. בקשו קישור חדש מהמנהל.</p>}
        {ready === false && <p className="mt-2 text-center text-sm text-white/70">פעם ראשונה כאן – בוחרים שם משתמש וסיסמה למנהל המערכת.</p>}
        <div className="mt-5 space-y-3 text-ink">
          <Input placeholder="שם משתמש" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input
            type="password"
            placeholder="סיסמה"
            autoComplete={ready ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {ready === false && <Input type="password" placeholder="שוב את הסיסמה" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />}
        </div>
        {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
        <Button type="submit" className="mt-5 w-full text-lg" disabled={busy || ready === null}>
          {ready === false ? 'יצירת מנהל' : 'כניסה'}
        </Button>
        <p className="mt-4 text-center text-xs text-white/60">מורים נכנסים דרך הקישור האישי שקיבלו מהמנהל.</p>
      </form>
    </div>
  );
}
