// כניסה: בפעם הראשונה קובעים סיסמה, אחר כך מקלידים אותה
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { Button, ErrorBox, Field, inputCls, Spinner } from './ui';

export default function Login({ onDone }) {
  const [hasPassword, setHasPassword] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/status')
      .then((r) => setHasPassword(r.hasPassword))
      .catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasPassword) {
      if (pw.length < 6) return setError('הסיסמה צריכה להיות באורך 6 תווים לפחות');
      if (pw !== pw2) return setError('שתי הסיסמאות לא זהות');
    }
    setBusy(true);
    try {
      const { token } = await api(hasPassword ? '/login' : '/setup', { password: pw });
      setToken(token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-on-accent"><TrendingUp size={30} /></span>
          <h1 className="text-2xl font-bold">בורסאי</h1>
          <p className="text-sm text-muted">השקעות במניות, בעברית פשוטה</p>
        </div>
        {hasPassword === null && !error && <Spinner />}
        {hasPassword !== null && (
          <>
            <h2 className="mb-3 text-lg font-bold">{hasPassword ? 'כניסה' : 'קביעת סיסמה'}</h2>
            {!hasPassword && <p className="mb-3 text-sm text-muted">זו הפעם הראשונה. בחרו סיסמה (6 תווים לפחות) שתשמור על התיק שלכם.</p>}
            <Field label="סיסמה">
              <input type="password" autoFocus autoComplete={hasPassword ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
            </Field>
            {!hasPassword && (
              <Field label="סיסמה שוב">
                <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} />
              </Field>
            )}
            <Button type="submit" busy={busy} className="mt-1 w-full">{hasPassword ? 'כניסה' : 'קביעת סיסמה והתחלה'}</Button>
          </>
        )}
        {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}
      </form>
    </div>
  );
}
