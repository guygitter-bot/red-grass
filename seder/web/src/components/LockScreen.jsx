import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { unlock } from '../lib/lock';
import { NetworkError, spaceStatus } from '../lib/sync';
import { SPACE, leaveSpace } from '../lib/space';

// מסך הכניסה – מופיע בכל פתיחה של האפליקציה, לפני שרואים משימות.
// באפליקציה של אדם נוסף (מרחב): בפתיחה הראשונה של הקישור בוחרים סיסמה.
export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // מרחב: setup – בחירת סיסמה, invalid – קישור שנמחק
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!SPACE) return;
    spaceStatus()
      .then((res) => {
        setName(res.name || '');
        if (res.needsSetup) setMode('setup');
      })
      .catch((e) => {
        if (!(e instanceof NetworkError)) {
          setMode('invalid');
          setError(e.message);
        }
      });
  }, []);

  const setup = mode === 'setup';

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    if (setup && password.length < 4) return setError('סיסמה של 4 תווים לפחות');
    if (setup && password !== confirm) return setError('שתי הסיסמאות לא זהות');
    setBusy(true);
    setError('');
    const res = await unlock(password, { setup });
    setBusy(false);
    if (res.ok) onUnlock(res);
    else if (res.needsSetup) setMode('setup');
    else {
      setError(res.error);
      setPassword('');
      setConfirm('');
    }
  };

  const input = 'w-full rounded-xl border border-stone-200 bg-card px-3 py-3 text-center outline-none focus:border-violet-500';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-violet-600 to-fuchsia-500" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center"><Lock size={28} /></div>
        <h1 className="text-2xl font-black text-violet-700 mt-3">יהיה בסדר</h1>
        {mode === 'invalid' ? (
          <>
            <p className="mt-3 text-sm text-rose-600">{error}</p>
            <button type="button" onClick={leaveSpace} className="mt-4 w-full rounded-2xl border border-stone-200 py-3">חזרה לאפליקציה הראשית</button>
          </>
        ) : (
          <>
            {setup ? (
              <p className="text-sm text-stone-600 mt-2">
                {name ? `שלום ${name}! ` : 'שלום! '}זו אפליקציית משימות חדשה, רק שלך – אף אחד אחר לא רואה את מה שכותבים בה.
                <span className="block mt-1 font-bold">בחרו סיסמה לכניסה (גם מהטלפון וגם מהמחשב):</span>
              </p>
            ) : (
              <p className="text-sm text-stone-500 mt-1">{SPACE ? `${name ? `${name}, ` : ''}הקלידו סיסמה כדי להיכנס` : 'הקלידי סיסמה כדי להיכנס'}</p>
            )}
            <input
              type="password"
              autoFocus
              autoComplete={setup ? 'new-password' : 'current-password'}
              aria-label="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={setup ? 'סיסמה חדשה' : 'סיסמה'}
              className={`mt-5 ${input}`}
            />
            {setup && (
              <input
                type="password"
                autoComplete="new-password"
                aria-label="שוב את הסיסמה"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="שוב את הסיסמה"
                className={`mt-2 ${input}`}
              />
            )}
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
            <button disabled={!password || busy} className="mt-4 w-full rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">
              {busy ? 'בודק...' : setup ? 'יצירת האפליקציה שלי' : 'כניסה'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
