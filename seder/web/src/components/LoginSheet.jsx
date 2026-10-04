import { useState } from 'react';
import { Cloud } from 'lucide-react';
import { login } from '../lib/sync';
import { Sheet } from './ui';

// חיבור המכשיר לסנכרון (פעם אחת בכל מכשיר)
export default function LoginSheet({ onClose, onLoggedIn, firstRun }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await login(password);
      onLoggedIn();
    } catch (err) {
      setError(navigator.onLine ? err.message || 'החיבור נכשל' : 'אין אינטרנט כרגע');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="סנכרון בין מכשירים" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex items-center gap-3 rounded-2xl bg-violet-50 p-3 text-sm text-violet-900">
          <Cloud size={28} className="shrink-0 text-violet-600" />
          <p>אחרי החיבור המשימות נשמרות גם בשרת, וזהות בטלפון ובמחשב. מה שכבר רשום במכשיר הזה יעלה ויתמזג.</p>
        </div>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          className="mt-4 w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-violet-500"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button disabled={!password || busy} className="mt-4 w-full rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">
          {busy ? 'מתחבר...' : 'חיבור'}
        </button>
        {firstRun && <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm text-stone-500">לא עכשיו (אפשר להתחבר אחר כך מההגדרות)</button>}
      </form>
    </Sheet>
  );
}
