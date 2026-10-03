import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { checkCode } from '../lib/api';

export default function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      await checkCode(value);
      onLogin(value);
    } catch (err) {
      setError(err.status === 401 ? 'קוד הגישה שגוי' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-orange-50 to-amber-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-6 text-center">
        <img src="icon.svg" alt="" className="w-16 h-16 mx-auto mb-3" />
        <h1 className="text-3xl font-black text-stone-900" dir="ltr">mat-kon</h1>
        <p className="text-stone-500 mb-6">ספר המתכונים שמסדר את עצמו</p>
        <label className="block text-right text-sm font-medium text-stone-700 mb-1.5" htmlFor="code">קוד גישה</label>
        <div className="relative">
          <KeyRound size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="code"
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-2xl border border-stone-200 py-3 pr-10 pl-3 outline-none focus:border-orange-400"
            dir="ltr"
          />
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <button
          disabled={busy || !code.trim()}
          className="mt-4 w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          כניסה
        </button>
      </form>
    </div>
  );
}
