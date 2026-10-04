import { useState } from 'react';
import { Lock } from 'lucide-react';
import { unlock } from '../lib/lock';

// מסך הכניסה – מופיע בכל פתיחה של האפליקציה, לפני שרואים משימות
export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    const res = await unlock(password);
    setBusy(false);
    if (res.ok) onUnlock(res);
    else {
      setError(res.error);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-violet-600 to-fuchsia-500" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center"><Lock size={28} /></div>
        <h1 className="text-2xl font-black text-violet-700 mt-3">סדר</h1>
        <p className="text-sm text-stone-500 mt-1">הקלידי סיסמה כדי להיכנס</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          className="mt-5 w-full rounded-xl border border-stone-200 px-3 py-3 text-center outline-none focus:border-violet-500"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button disabled={!password || busy} className="mt-4 w-full rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">
          {busy ? 'בודק...' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
