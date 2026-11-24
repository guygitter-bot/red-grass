// כניסה: בפעם הראשונה קובעים סיסמה, אחר כך נכנסים איתה
import { useEffect, useState } from 'react';
import { api, setToken } from '../lib/api';
import { Button, Card, ErrorLine, Field, Logo, inputClass } from '../components/ui';

export default function Login({ onDone }) {
  const [ready, setReady] = useState(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/status')
      .then((d) => setReady(d.ready))
      .catch((e) => setError(e.message));
  }, []);

  const first = ready === false;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (first && password !== again) {
      setError('הסיסמאות לא זהות');
      return;
    }
    setBusy(true);
    try {
      const { token } = await api('POST', '/login', { password });
      setToken(token);
      onDone(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-night px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <Logo />
          <h1 className="mt-3 text-xl font-bold">{first ? 'קביעת סיסמה' : 'כניסה'}</h1>
          {first && <p className="mt-1 text-sm text-muted">פעם ראשונה כאן – בחרו סיסמה (6 תווים לפחות). רק איתה אפשר להיכנס.</p>}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="סיסמה">
            <input type="password" autoComplete={first ? 'new-password' : 'current-password'} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {first && (
            <Field label="שוב, לאימות">
              <input type="password" autoComplete="new-password" className={inputClass} value={again} onChange={(e) => setAgain(e.target.value)} required />
            </Field>
          )}
          <ErrorLine text={error} />
          <Button type="submit" className="w-full" disabled={busy || ready === null}>
            {busy ? 'רגע…' : first ? 'קביעה וכניסה' : 'כניסה'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
