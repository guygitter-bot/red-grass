import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { setLastGame } from '../lib/profile';
import Lobby, { Invite } from './Lobby';
import Question from './Question';
import Over from './Over';
import { Avatar, Button, Card, ThemeButton } from './ui';

// משחק אחד: מצטרפים, ואז שואלים את השרת כל שנייה מה חדש
export default function Game({ code, profile, onExit, onEditProfile }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');
  const [invite, setInvite] = useState(false);
  const version = useRef(0);
  const offset = useRef(0);
  const auth = { code, playerId: profile.id, token: profile.token };

  // השעון של השרת (כדי שלכולם השיר יתחיל והזמן ייגמר באותו רגע, גם אם השעון בטלפון לא מדויק)
  const now = useCallback(() => Date.now() + offset.current, []);

  const apply = (data) => {
    if (typeof data.now === 'number') offset.current = data.now - Date.now();
    if (!data.same && data.players) {
      version.current = data.v;
      setState(data);
    }
  };

  const act = async (path, extra = {}) => {
    try {
      const data = await api(path, { ...auth, ...extra });
      apply(data);
      setError('');
      return data;
    } catch (e) {
      if (e.status === 409 || e.status === 400 || e.status === 403) setError(e.message);
      throw e;
    }
  };

  useEffect(() => {
    let stop = false;
    let timer;
    const loop = async (joining) => {
      try {
        const data = joining ? await api('/join', { code, player: profile }) : await api('/state', { ...auth, v: version.current });
        if (stop) return;
        apply(data);
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
      timer = setTimeout(() => loop(false), document.hidden ? 4000 : 1000);
    };
    loop(true);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code, profile.id, profile.name, profile.photo]); // eslint-disable-line react-hooks/exhaustive-deps

  // הודעת שגיאה נעלמת אחרי כמה שניות
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(''), 4000);
    return () => {
      clearTimeout(t);
    };
  }, [error]);

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
  const playing = state.phase === 'question' || state.phase === 'reveal';
  return (
    <div className="mx-auto max-w-5xl px-4 pt-3 pb-10">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" onClick={onExit} className="text-lg font-extrabold whitespace-nowrap text-accent-ink sm:text-xl">
          מה השיר?
        </button>
        <button type="button" dir="ltr" onClick={() => setInvite(!invite)} className="rounded-full bg-soft px-2 py-1 text-sm font-bold whitespace-nowrap tracking-wider">
          {code} <span className="max-[400px]:hidden">+👤</span>
        </button>
        <div className="mr-auto flex items-center">
          <ThemeButton />
          <button type="button" onClick={onEditProfile} aria-label="עריכת פרופיל" className="rounded-full">
            <Avatar player={me} size={36} />
          </button>
          <Button kind="ghost" className="px-2 py-2 text-sm" onClick={leave}>
            יציאה
          </Button>
        </div>
      </header>

      {error && <Card className="mb-3 border-red-300 py-2 text-center text-sm text-bad">{error}</Card>}
      {invite && state.phase !== 'lobby' && (
        <div className="mb-4">
          <Invite code={code} />
        </div>
      )}

      {state.phase === 'lobby' && <Lobby state={state} act={act} />}
      {state.phase === 'loading' && (
        <div className="flex flex-col items-center gap-4 pt-16 text-center">
          <div className="eq text-accent">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="text-lg">בוחרים שירים...</p>
        </div>
      )}
      {playing && state.game && <Question key={`${state.game.n}-${state.game.q}`} state={state} act={act} now={now} />}
      {state.phase === 'over' && state.game && <Over state={state} act={act} />}
    </div>
  );
}
