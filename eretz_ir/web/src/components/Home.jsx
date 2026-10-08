import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { codeFrom } from '../lib/game';
import { lastGame } from '../lib/profile';
import { Avatar, Button, Card } from './ui';

// התקנה במסך הבית: באנדרואיד/מחשב – הכפתור של הדפדפן; באייפון – הסבר קצר
let installEvent = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
  });
}
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function Install() {
  const [, refresh] = useState(0);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    const on = () => refresh((n) => n + 1);
    window.addEventListener('beforeinstallprompt', on);
    return () => {
      window.removeEventListener('beforeinstallprompt', on);
    };
  }, []);
  if (standalone()) return null;
  if (installEvent) {
    return (
      <Button
        kind="secondary"
        onClick={async () => {
          installEvent.prompt();
          await installEvent.userChoice.catch(() => {});
          installEvent = null;
          refresh((n) => n + 1);
        }}
      >
        📲 התקנה כאפליקציה בטלפון
      </Button>
    );
  }
  if (!isIOS()) return null;
  return (
    <div className="text-center text-sm text-muted">
      <button type="button" className="underline" onClick={() => setIosHelp(!iosHelp)}>
        📲 איך מתקינים באייפון?
      </button>
      {iosHelp && <p className="mt-2">בספארי: כפתור השיתוף (ריבוע עם חץ) ← "הוספה למסך הבית".</p>}
    </div>
  );
}

export default function Home({ profile, onEditProfile, onOpen }) {
  const [joinText, setJoinText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const last = lastGame();

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api('/create', { player: profile });
      onOpen(data.code);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const join = (e) => {
    e.preventDefault();
    const code = codeFrom(joinText);
    if (!code) return setError('הקוד הוא 5 אותיות ומספרים (או להדביק את הקישור)');
    onOpen(code);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 lg:pt-10">
      <div className="py-4 text-center">
        <div className="pop mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-accent text-6xl font-extrabold text-white shadow-lg">א</div>
        <h1 className="mt-4 text-4xl font-extrabold text-accent-ink">ארץ עיר</h1>
        <p className="mt-1 text-muted">משחקים עם חברים – כל אחד מהטלפון שלו</p>
      </div>

      <Card className="flex items-center gap-3">
        <Avatar player={profile} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">משחק/ת בתור</div>
          <div className="truncate text-lg font-bold">{profile.name}</div>
        </div>
        <Button kind="ghost" className="text-sm" onClick={onEditProfile}>
          ✏️ עריכה
        </Button>
      </Card>

      {last && (
        <Button kind="secondary" onClick={() => onOpen(last)}>
          ↩️ חזרה למשחק {last}
        </Button>
      )}

      <Button className="py-4 text-xl" onClick={create} disabled={busy}>
        {busy ? 'פותח משחק...' : '🎲 משחק חדש'}
      </Button>

      <Card>
        <form onSubmit={join} className="flex flex-col gap-2">
          <label htmlFor="join" className="text-sm text-muted">
            יש לך קוד או קישור מחבר/ה?
          </label>
          <div className="flex gap-2">
            <input
              id="join"
              value={joinText}
              onChange={(e) => setJoinText(e.target.value)}
              placeholder="קוד משחק"
              dir="ltr"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-page px-4 py-3 text-center text-lg font-bold tracking-widest uppercase outline-none focus:border-accent"
            />
            <Button type="submit" kind="secondary">
              הצטרפות
            </Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Install />

      <Card className="text-sm leading-relaxed text-muted">
        <div className="mb-1 font-bold text-ink">איך משחקים?</div>
        פותחים משחק ושולחים לחברים את הקישור. בכל סיבוב יוצאת אות, ולכל אחד יש זמן קצוב למלא: ארץ, עיר, חי, צומח, דומם, ילד, ילדה,
        מקצוע. בסוף רואים את התשובות של כולם: תשובה נכונה שרק את/ה כתבת – <b className="text-ink">10 נקודות</b>, תשובה שגם אחרים כתבו –{' '}
        <b className="text-ink">5 נקודות</b> לכל אחד.
      </Card>
    </div>
  );
}
