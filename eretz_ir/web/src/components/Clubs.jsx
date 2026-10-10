import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { clubAuth, clubLink, enableNotifications, forgetClub, myClubs, notifyState, rememberClub } from '../lib/clubs';
import { Avatar, Button, Card } from './ui';

const SHARE_TEXT = (name) => `בואו להצטרף לקהילת "${name}" במשחק ארץ עיר – ככה נדע מתי מישהו רוצה לשחק 🎲`;

// כפתור התראות: מצב + הפעלה
export function NotifyButton({ profile, codes, onChange }) {
  const [state, setState] = useState(notifyState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (state === 'unsupported') return <p className="text-sm text-muted">המכשיר הזה לא תומך בהתראות. אפשר לראות הזמנות כשנכנסים לאפליקציה.</p>;
  if (state === 'ios-install') {
    return (
      <p className="text-sm text-muted">
        🔔 כדי לקבל התראות באייפון: בספארי לוחצים על כפתור השיתוף ← "הוספה למסך הבית", ופותחים את האפליקציה משם.
      </p>
    );
  }
  if (state === 'denied') return <p className="text-sm text-muted">🔕 ההתראות חסומות. אפשר לאשר אותן בהגדרות הדפדפן של האתר.</p>;

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await enableNotifications(profile, codes);
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
    setState(notifyState());
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <Button kind={state === 'granted' ? 'secondary' : 'primary'} onClick={enable} disabled={busy}>
        {busy ? 'מפעיל...' : state === 'granted' ? '🔔 ההתראות פועלות (רענון)' : '🔔 הפעלת התראות כשחברים רוצים לשחק'}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// "שגיא מחכה במשחק ABCDE"
function InviteBanner({ invite, me, onOpenGame }) {
  if (!invite || invite.by === me) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenGame(invite.game)}
      className="pop w-full rounded-2xl bg-accent px-4 py-3 text-right font-medium text-white shadow hover:brightness-110"
    >
      🎲 {invite.name} רוצה לשחק! <span className="underline">להצטרפות למשחק {invite.game}</span>
    </button>
  );
}

// בדף הבית: הקהילות שלי, הזמנות פתוחות, ופתיחת קהילה חדשה
export function ClubsCard({ profile, onOpenClub, onOpenGame }) {
  const [clubs, setClubs] = useState(myClubs);
  const [invites, setInvites] = useState({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // מי מחכה עכשיו למשחק (גם בלי התראות)
  useEffect(() => {
    let stop = false;
    for (const c of clubs) {
      api('/club/get', clubAuth(c.code, profile))
        .then((data) => {
          if (stop) return;
          setInvites((all) => ({ ...all, [c.code]: data.invite }));
          if (data.name !== c.name) rememberClub(data);
        })
        .catch((e) => {
          // יצאו מהקהילה / נמחקה – מורידים מהרשימה
          if (!stop && (e.status === 404 || e.status === 403)) {
            forgetClub(c.code);
            setClubs(myClubs());
          }
        });
    }
    return () => {
      stop = true;
    };
  }, [clubs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('איך נקרא לקהילה?');
    setBusy(true);
    setError('');
    try {
      const data = await api('/club/create', { name, player: profile });
      rememberClub(data);
      enableNotifications(profile, [data.code], false).catch(() => {});
      onOpenClub(data.code);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="font-bold">👥 הקהילות שלי</div>
      {clubs.length === 0 && (
        <p className="text-sm text-muted">
          קהילה = קבוצת חברים או משפחה עם שם משלה (למשל "המשפחה", "החברים מהכיתה"). אפשר כמה קהילות נפרדות. כשמישהו רוצה
          לשחק – כל מי שבקהילה מקבל התראה לטלפון עם קישור למשחק.
        </p>
      )}
      {clubs.map((c) => (
        <div key={c.code} className="flex flex-col gap-2">
          <InviteBanner invite={invites[c.code]} me={profile.id} onOpenGame={onOpenGame} />
          <button
            type="button"
            onClick={() => onOpenClub(c.code)}
            className="flex items-center justify-between rounded-2xl border border-line bg-page px-4 py-3 text-right hover:bg-soft"
          >
            <span className="font-medium">{c.name}</span>
            <span className="text-muted">‹</span>
          </button>
        </div>
      ))}
      {creating ? (
        <form onSubmit={create} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoFocus
            placeholder="שם הקהילה, למשל: המשפחה"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-page px-4 py-3 outline-none focus:border-accent"
          />
          <Button type="submit" disabled={busy}>
            יצירה
          </Button>
        </form>
      ) : (
        <Button kind="secondary" onClick={() => setCreating(true)}>
          ➕ קהילה חדשה
        </Button>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-sm text-muted">קיבלת קישור לקהילה? פשוט ללחוץ עליו.</p>
    </Card>
  );
}

// מסך קהילה: מי בפנים, הזמנת חברים, התראות, ו"משחק חדש וקריאה לכולם"
export function ClubScreen({ code, profile, onExit, onOpenGame }) {
  const [club, setClub] = useState(null);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const load = (joining) =>
    api(joining ? '/club/join' : '/club/get', joining ? { club: code, player: profile } : clubAuth(code, profile))
      .then((data) => {
        setClub(data);
        if (joining) {
          rememberClub(data);
          // מי שכבר אישר התראות – נרשם גם בקהילה החדשה בלי לשאול שוב
          enableNotifications(profile, [code], false).then((on) => on && load(false)).catch(() => {});
        }
      })
      .catch((e) => {
        if (e.status === 404 || e.status === 403 || e.status === 409) {
          if (e.status !== 409) forgetClub(code);
          setFatal(e.message);
        } else setError(e.message);
      });

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), 15000);
    return () => {
      clearInterval(id);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const playNow = async () => {
    setBusy(true);
    setError('');
    try {
      const game = await api('/create', { player: profile });
      await api('/club/invite', { ...clubAuth(code, profile), game: game.code }).catch(() => {});
      onOpenGame(game.code);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!window.confirm(`לצאת מהקהילה "${club.name}"?`)) return;
    await api('/club/leave', clubAuth(code, profile)).catch(() => {});
    forgetClub(code);
    onExit();
  };

  const rename = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const data = await api('/club/rename', { ...clubAuth(code, profile), name: newName });
      setClub(data);
      rememberClub(data);
      setRenaming(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const url = clubLink(code);
  const share = async () => {
    try {
      await navigator.share({ title: 'ארץ עיר', text: SHARE_TEXT(club.name), url });
    } catch (e) {
      if (e.name !== 'AbortError') copy();
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('להעתיק את הקישור:', url);
    }
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
  if (!club) return <div className="pt-24 text-center text-muted">{error || 'נכנס/ת לקהילה...'}</div>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-3 pb-10 lg:max-w-3xl">
      <header className="flex items-center gap-2">
        <button type="button" onClick={onExit} className="text-xl font-extrabold text-accent-ink">
          ארץ עיר
        </button>
        <span className="text-muted">‹</span>
        {renaming ? (
          <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-1.5 outline-none focus:border-accent"
            />
            <Button type="submit" className="px-3 py-1.5">
              שמירה
            </Button>
          </form>
        ) : (
          <>
            <h1 className="truncate text-xl font-bold">👥 {club.name}</h1>
            <button
              type="button"
              aria-label="שינוי שם הקהילה"
              title="שינוי שם הקהילה"
              onClick={() => {
                setNewName(club.name);
                setRenaming(true);
              }}
              className="rounded-full px-2 py-1 text-muted hover:bg-soft"
            >
              ✏️
            </button>
          </>
        )}
      </header>

      <InviteBanner invite={club.invite} me={profile.id} onOpenGame={onOpenGame} />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <Button className="py-4 text-xl" onClick={playNow} disabled={busy}>
            {busy ? 'פותח משחק...' : '🎲 משחק חדש וקריאה לכולם'}
          </Button>
          <p className="-mt-2 text-center text-sm text-muted">כל מי שהפעיל התראות יקבל: "{profile.name} רוצה לשחק ארץ עיר!"</p>
          <Card className="flex flex-col gap-2">
            <NotifyButton profile={profile} codes={myClubs().map((c) => c.code)} onChange={() => load(false)} />
          </Card>
          <Card className="text-center">
            <div className="mb-2 font-bold">הזמנת חברים לקהילה</div>
            <div className="flex flex-wrap justify-center gap-2">
              {navigator.share && <Button onClick={share}>📤 שיתוף</Button>}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT(club.name)}\n${url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#25d366] px-4 py-3 font-medium text-white shadow-sm hover:brightness-110"
              >
                וואטסאפ
              </a>
              <Button kind="secondary" onClick={copy}>
                {copied ? '✓ הועתק' : '🔗 העתקת קישור'}
              </Button>
            </div>
          </Card>
        </div>
        <Card>
          <div className="mb-3 font-bold">מי בקהילה ({club.members.length})</div>
          <ul className="flex flex-col gap-2">
            {club.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar player={m} size={40} />
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  {m.id === club.me && <span className="text-sm text-muted"> (את/ה)</span>}
                </span>
                <span title={m.notify ? 'מקבל/ת התראות' : 'בלי התראות'} className={m.notify ? '' : 'opacity-30'}>
                  {m.notify ? '🔔' : '🔕'}
                </span>
              </li>
            ))}
          </ul>
          <Button kind="ghost" className="mt-3 w-full text-sm" onClick={leave}>
            יציאה מהקהילה
          </Button>
        </Card>
      </div>
      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// בחדר ההמתנה: "לקרוא לחברים" מכל קהילה שלי
export function CallFriends({ profile, game }) {
  const clubs = myClubs();
  const [status, setStatus] = useState({});
  if (!clubs.length) return null;
  const call = async (c) => {
    setStatus((s) => ({ ...s, [c.code]: 'שולח...' }));
    try {
      const res = await api('/club/invite', { ...clubAuth(c.code, profile), game });
      const text = res.again ? '✓ כבר נשלח' : res.sent ? `✓ נשלח ל-${res.sent}` : '✓ נשלח (אף אחד עוד לא הפעיל התראות)';
      setStatus((s) => ({ ...s, [c.code]: text }));
    } catch (e) {
      setStatus((s) => ({ ...s, [c.code]: e.message }));
    }
  };
  return (
    <Card className="flex flex-col gap-2">
      <div className="font-bold">📣 לקרוא לחברים מהקהילה</div>
      {clubs.map((c) => (
        <div key={c.code} className="flex items-center gap-2">
          <Button kind="secondary" className="flex-1" onClick={() => call(c)}>
            📣 {c.name}
          </Button>
          {status[c.code] && <span className="text-sm text-muted">{status[c.code]}</span>}
        </div>
      ))}
    </Card>
  );
}
