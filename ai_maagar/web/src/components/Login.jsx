import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api, setToken } from '../lib/api';

// כניסה עם סיסמה (פעם אחת בכל מכשיר)
export default function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api('/login', { password });
      setToken(token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-page">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-line rounded-3xl p-6 shadow-sm space-y-4">
        <div className="text-center space-y-2">
          <img src="icon.svg" alt="" className="w-16 h-16 mx-auto" />
          <h1 className="text-2xl font-bold">מאגר AI</h1>
          <p className="text-muted text-sm">כל החומר על AI במקום אחד, מסודר לפי נושאים</p>
        </div>
        <label className="block">
          <span className="text-sm text-muted">סיסמה</span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-page px-4 py-3 outline-none focus:border-accent"
          />
        </label>
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        <button disabled={busy || !password} className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white py-3 font-medium disabled:opacity-50">
          <Lock size={18} /> {busy ? 'נכנסת...' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
