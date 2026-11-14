import { useEffect, useState } from 'react';
import { health, login } from '../lib/api';

// כניסה בסיסמה. מי שנכנס ראשון לאפליקציה קובע את הסיסמה (היא מגינה על החשבון שמשלם על הסרטונים)
export default function Login({ onDone }) {
  const [first, setFirst] = useState(null); // null = עוד בודקים, true = צריך לקבוע סיסמה
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    health().then((h) => setFirst(!h.hasPassword)).catch(() => setFirst(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <img src="icon.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold">סרטון נדל״ן</h1>
        <p className="mt-2 text-muted">מצילום או שרטוט – לסרטון תדמית של הפרויקט</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-5">
        <label className="label" htmlFor="password">{first ? 'קבעו סיסמה לאפליקציה' : 'סיסמה'}</label>
        <input id="password" type="password" className="field" autoComplete={first ? 'new-password' : 'current-password'} value={password}
          onChange={(e) => setPassword(e.target.value)} disabled={first === null} />
        {first && <p className="mt-2 text-sm text-muted">לפחות 6 תווים. זו הסיסמה שתתנו למי שמותר לו ליצור סרטונים.</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
        <button className="btn btn-main mt-4 w-full" disabled={busy || first === null || !password}>
          {busy ? <span className="spinner" /> : first ? 'לקבוע ולהיכנס' : 'כניסה'}
        </button>
      </form>
    </main>
  );
}
