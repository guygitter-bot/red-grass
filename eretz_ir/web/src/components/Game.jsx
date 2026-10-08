import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { rememberLetter, setLastGame } from '../lib/profile';
import Lobby, { Invite } from './Lobby';
import Play from './Play';
import Results from './Results';
import { Avatar, Button, Card, ThemeButton } from './ui';

// משחק אחד: מצטרפים, ואז שואלים את השרת כל שנייה וחצי מה חדש
export default function Game({ code, profile, onExit, onEditProfile }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');
  const [invite, setInvite] = useState(false);
  const version = useRef(0);
  const offset = useRef(0);
  const auth = { code, playerId: profile.id, token: profile.token };

  // השעון של השרת (כדי שלכולם ייגמר הזמן באותו רגע, גם אם השעון בטלפון לא מדויק)
  const now = useCallback(() => Date.now() + offset.current, []);

  const apply = (data) => {
    if (typeof data.now === 'number') offset.current = data.now - Date.now();
    if (!data.same && data.players) {
      version.current = data.v;
      setState(data);
    }
  };

  const act = async (path, extra = {}) => {
    const data = await api(path, { ...auth, ...extra });
    apply(data);
    return data;
  };

  useEffect(() => {
    let stop = false;
    let timer;
    const loop = async (joining) => {
      try {
        const data = joining ? await api('/join', { code, player: profile }) : await api('/state', { ...auth, v: version.current });
        if (stop) return;
        apply(data);
        setError('');
        if (joining) setLastGame(code);
      } catch (e) {
        if (stop) return;
        if (e.status === 404 || e.status === 403 || (joining && e.status === 409)) {
          if (e.status !== 409) setLastGame('');
          setFatal(e.message);
          return;
        }
        setError(e.message);
        if (joining) {
          timer = setTimeout(() => loop(true), 3000);
          return;
        }
      }
      timer = setTimeout(() => loop(false), document.hidden ? 5000 : 1500);
    };
    loop(true);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code, profile.id, profile.name, profile.photo]); // eslint-disable-line react-hooks/exhaustive-deps

  // האות של הסיבוב נשמרת במכשיר, כדי שלא תחזור מהר גם במשחק הבא
  const letter = state?.round?.letter;
  useEffect(() => {
    if (letter) rememberLetter(letter);
  }, [letter]);

  const leave = async () => {
    if (!window.confirm('לצאת מהמשחק? הניקוד שלך יימחק מהמשחק הזה.')) return;
    await act('/leave').catch(() => {});
    setLastGame('');
    onExit();
  };

  if (fatal) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-16 text-center">
        <div className="text-5xl">🤷</div>
        <p className="text-lg">{fatal}</p>
        <Button onClick={onExit}>למסך הראשי</Button>
      </div>
    );
  }

  if (!state) {
    return <div className="pt-24 text-center text-muted">{error || 'מצטרף/ת למשחק...'}</div>;
  }

  const me = state.players.find((p) => p.id === state.me);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-3">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onExit} className="text-xl font-extrabold text-accent-ink">
          ארץ עיר
        </button>
        <button type="button" dir="ltr" onClick={() => setInvite(!invite)} className="rounded-full bg-soft px-3 py-1 text-sm font-bold tracking-widest">
          {code} +👤
        </button>
        <div className="mr-auto flex items-center gap-1">
          <ThemeButton />
          <button type="button" onClick={onEditProfile} aria-label="עריכת פרופיל" className="rounded-full">
            <Avatar player={me} size={36} />
          </button>
          <Button kind="ghost" className="px-3 py-2 text-sm" onClick={leave}>
            יציאה
          </Button>
        </div>
      </header>

      {error && <Card className="mb-3 border-red-300 py-2 text-center text-sm text-red-600 dark:text-red-400">{error} – מנסה שוב...</Card>}
      {invite && state.phase !== 'lobby' && (
        <div className="mb-4">
          <Invite code={code} />
        </div>
      )}

      {state.phase === 'lobby' && <Lobby state={state} act={act} />}
      {state.phase === 'playing' && <Play key={state.round.n} state={state} act={act} now={now} />}
      {state.phase === 'results' && <Results state={state} act={act} />}
    </div>
  );
}
