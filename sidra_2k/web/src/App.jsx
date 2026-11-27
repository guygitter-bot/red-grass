// "הסדרה" – סדרות פלייאוף ב-2K, אבא נגד הבן. מסך אחד: הלוח, המשחק הבא, לוח המשחקים, טבלת האלופים וכלים.
import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import Schedule from './components/Schedule';
import Logo from './components/Logo';
import Titles from './components/Titles';
import NewSeries from './components/NewSeries';
import { TEAM, champion, homeTeam, other, shareText, titles, wins } from './lib/series';
import { cached, call } from './lib/api';
import { confetti } from './lib/confetti';
import { getTheme, setTheme } from './lib/theme';

const btn = 'rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold hover:border-muted disabled:opacity-50';

// מי משחק עם איזו קבוצה (ולפני משחק 1 – גם למי יתרון הביתיות)
function Players({ series, onSave, onCancel }) {
  const [a, b] = series.teams;
  const [na, setNa] = useState(series.players[a]);
  const [nb, setNb] = useState(series.players[b]);
  const [home, setHome] = useState(a);
  // שמות מהסדרה הקודמת – הצעה, כדי שטבלת האלופים תספור כל אחד תחת אותו שם
  const known = [...new Set(series.history.flatMap((h) => Object.values(h.players || {})).filter(Boolean))].slice(-6);
  const row = (team, value, set) => (
    <label className="grid grid-cols-[auto_1fr] items-center gap-3">
      <Logo team={team} className="h-10 w-10" />
      <input value={value} onChange={(e) => set(e.target.value)} maxLength={20} list="known-names" placeholder={`מי משחק ב${TEAM[team].name}?`} className="w-full rounded-lg border border-line bg-page px-3 py-2.5" />
    </label>
  );
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold bg-card p-4">
      <h3 className="text-lg font-black">מי משחק עם איזו קבוצה?</h3>
      <datalist id="known-names">
        {known.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {row(a, na, setNa)}
      {row(b, nb, setNb)}
      {!series.games.length && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold">יתרון ביתיות:</span>
          {[a, b].map((t) => (
            <button key={t} type="button" aria-pressed={home === t} onClick={() => setHome(t)} className={`rounded-full border-2 px-3 py-1 font-bold ${home === t ? 'border-gold bg-gold/15' : 'border-line'}`}>
              {TEAM[t].city}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-gold px-4 py-2 font-black text-[#1b0d2e] disabled:opacity-50"
          disabled={!na.trim() || !nb.trim()}
          onClick={() => onSave({ players: { [a]: na.trim(), [b]: nb.trim() }, home })}
        >
          שמור
        </button>
        <button
          className={btn}
          onClick={() => {
            setNa(nb);
            setNb(na);
          }}
        >
          ⇄ להחליף ביניהם
        </button>
        {onCancel && (
          <button className={btn} onClick={onCancel}>
            ביטול
          </button>
        )}
      </div>
    </section>
  );
}

// המשחק הבא: מי ניצח (ותוצאה אם רוצים)
function NextGame({ series, busy, onWin }) {
  const n = series.games.length;
  const home = homeTeam(series.teams, n);
  const w = wins(series);
  const empty = Object.fromEntries(series.teams.map((t) => [t, '']));
  const [pts, setPts] = useState(empty);
  const who = (t) => series.players[t] || TEAM[t].short;
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4 lg:p-5">
      <div>
        <h3 className="text-xl font-black">
          משחק {n + 1}
          {n === 6 ? ' · משחק 7 המכריע!' : ''}
        </h3>
        <div className="text-sm text-muted">
          בבית של {TEAM[home].city} · {TEAM[other(series.teams, home)].short} באים לבקר
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {series.teams.map((t) => (
          <button
            key={t}
            disabled={busy}
            onClick={() => onWin(t, pts).then((ok) => ok && setPts(empty))}
            className={`pick-${t} flex items-center justify-center gap-2.5 rounded-xl px-2.5 py-3.5 text-[17px] font-black transition hover:-translate-y-0.5 disabled:opacity-60`}
          >
            <Logo team={t} className="h-9 w-9 shrink-0" />
            ניצח {who(t)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="w-full lg:w-auto">תוצאה (לא חובה):</span>
        {series.teams.map((t) => (
          <label key={t} className="flex items-center gap-1.5">
            {TEAM[t].name}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="250"
              value={pts[t] ?? ''}
              onChange={(e) => setPts({ ...pts, [t]: e.target.value })}
              className="num w-16 rounded-lg border border-line bg-page p-2 text-center text-base text-ink"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function Champion({ series, onNew }) {
  const ch = champion(series);
  const w = wins(series);
  return (
    <section className={`champ-${ch} flex flex-col items-center gap-2 rounded-2xl px-4 py-7 text-center`}>
      <div className="text-6xl leading-none">🏆</div>
      <Logo team={ch} className="h-20 w-20" />
      <div className="text-[clamp(26px,6vw,46px)] leading-tight font-black italic">{series.players[ch] || TEAM[ch].short} אלוף הסדרה!</div>
      <div className="font-semibold text-white">
        {TEAM[ch].city} {TEAM[ch].name} ניצחו{' '}
        <span dir="ltr">
          {w[ch]}–{w[other(series.teams, ch)]}
        </span>{' '}
        ב-{series.games.length} משחקים
      </div>
      <button className="mt-1 rounded-lg border border-white/30 px-3.5 py-2 text-sm font-semibold text-white" onClick={() => confetti(ch)}>
        🎉 עוד קונפטי
      </button>
      {onNew && (
        <button className="rounded-lg bg-gold px-4 py-2 font-black text-[#1b0d2e]" onClick={onNew}>
          🏀 להתחיל סדרה חדשה
        </button>
      )}
    </section>
  );
}

// צופה (לא מאסטר): רק מה המשחק הבא, בלי כפתורים
function ViewerNext({ series }) {
  const n = series.games.length;
  const home = homeTeam(series.teams, n);
  return (
    <section className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <h3 className="text-lg font-black">המשחק הבא: משחק {n + 1}</h3>
      <div className="text-sm text-muted">
        בבית של {TEAM[home].city} · רק המאסטר רושם תוצאות, והמסך מתעדכן לבד
      </div>
    </section>
  );
}

// כניסת מאסטר: בפעם הראשונה קובעים סיסמה, אחר כך נכנסים איתה
function MasterSheet({ series, onDone, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = !series.locked;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await call(first ? 'setup' : 'login', { password }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-gold bg-card p-4">
      <h3 className="text-lg font-black">{first ? '👑 קביעת סיסמת מאסטר' : '👑 כניסת מאסטר'}</h3>
      <p className="text-sm text-muted">
        {first ? 'מי שקובע את הסיסמה הוא המאסטר – רק הוא יכול לרשום ולשנות תוצאות. כל השאר רק צופים.' : 'רק המאסטר יכול לרשום ולשנות תוצאות.'}
      </p>
      <input
        id="master-password"
        type="password"
        autoFocus
        autoComplete={first ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={first ? 'סיסמה חדשה (לפחות 4 תווים)' : 'סיסמה'}
        className="w-full rounded-lg border border-line bg-page px-3 py-2.5"
      />
      {error && <div className="text-sm text-live">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || password.length < (first ? 4 : 1)} className="rounded-lg bg-gold px-4 py-2 font-black text-[#1b0d2e] disabled:opacity-50">
          {first ? 'קבע סיסמה' : 'כניסה'}
        </button>
        <button type="button" className={btn} onClick={onClose}>
          ביטול
        </button>
      </div>
    </form>
  );
}

const THEMES = { auto: '🌓 אוטומטי', dark: '🌙 לילה', light: '☀️ יום' };

export default function App() {
  const [series, setSeries] = useState(cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editPlayers, setEditPlayers] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [theme, setThemeState] = useState(getTheme);
  const [popped, setPopped] = useState(null);
  const [showMaster, setShowMaster] = useState(false);
  const [toast, setToast] = useState('');
  const [showNew, setShowNew] = useState(false);
  const prev = useRef(null);

  // רענון מהשרת: בפתיחה, כל 15 שניות וכשחוזרים לאפליקציה
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      call('get')
        .then((s) => {
          if (alive) {
            setSeries(s);
            setError('');
          }
        })
        .catch(() => {
          if (alive) setError('אין חיבור לשרת – מוצגת התוצאה האחרונה ששמורה במכשיר');
        });
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // קבוצה שקיבלה ניצחון – המספר "קופץ"; סדרה שהוכרעה עכשיו – קונפטי
  useEffect(() => {
    const w = wins(series);
    const ch = champion(series);
    const p = prev.current;
    // אותה סדרה (אותן קבוצות) – משווים לפעם הקודמת
    if (p && p.key === series.teams.join()) {
      const up = series.teams.find((t) => w[t] > p.w[t]);
      if (up) setPopped(up);
      if (!p.ch && ch) confetti(ch);
    }
    prev.current = { key: series.teams.join(), w, ch };
  }, [series]);

  const run = async (path, body) => {
    setBusy(true);
    try {
      setSeries(await call(path, body));
      setError('');
      return true;
    } catch (e) {
      setError(e.message || 'אין חיבור לשרת – נסו שוב');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // שיתוף: חלון השיתוף של הטלפון, ואם אין – העתקת הקישור
  const share = async () => {
    const url = `${location.origin}${location.pathname}`;
    const text = shareText(series);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'הסדרה', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setToast('הקישור הועתק – אפשר להדביק בווטסאפ');
    } catch (e) {
      if (e?.name !== 'AbortError') setToast(`הקישור: ${url}`);
    }
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => {
      clearTimeout(t);
    };
  }, [toast]);

  const master = series.master;
  const ch = champion(series);
  const needPlayers = series.teams.some((t) => !series.players[t]);
  const table = titles(series.history);
  const n = series.games.length;

  return (
    <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:pt-6">
    <main className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide text-muted">
          <span className="live num rounded bg-live px-2 py-0.5 text-xs tracking-[.12em] text-white">LIVE</span>
          פלייאוף 2K27 · אבא נגד הבן
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
        <button className="rounded-full bg-gold px-3 py-1 text-xs font-black text-[#1b0d2e]" onClick={share}>
          ↗ שיתוף
        </button>
        <button
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${master ? 'border-gold text-gold' : 'border-line bg-card text-muted'}`}
          onClick={() => (master ? setConfirm('logout') : setShowMaster(!showMaster))}
        >
          {master ? '👑 מאסטר' : '🔒 מאסטר'}
        </button>
        <button
          className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted"
          onClick={() => {
            const next = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
            setTheme(next);
            setThemeState(next);
          }}
        >
          {THEMES[theme]}
        </button>
        </div>
      </header>

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 mx-auto w-fit max-w-[90%] rounded-full bg-ink px-4 py-2 text-sm font-semibold text-page shadow-lg">
          {toast}
        </div>
      )}

      {showMaster && !master && (
        <MasterSheet
          series={series}
          onClose={() => setShowMaster(false)}
          onDone={(s) => {
            setSeries(s);
            setShowMaster(false);
            setToast('נכנסת כמאסטר 👑');
          }}
        />
      )}

      <Board series={series} popped={popped} />

      {/* בטלפון: שורה קצרה של טבלת האלופים מתחת ללוח (הטבלה המלאה למטה) */}
      {table.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm lg:hidden">
          <span className="font-bold text-muted">🏆 אלופים:</span>
          {table.map(({ name, n: c }) => (
            <span key={name} className="rounded-full border border-gold/60 bg-gold/15 px-2.5 py-0.5 font-bold">
              {name} <span className="num">×{c}</span>
            </span>
          ))}
        </div>
      )}

      {master && showNew && (
        <NewSeries
          series={series}
          busy={busy}
          onClose={() => setShowNew(false)}
          onStart={(body) =>
            run('new', body).then((ok) => {
              if (ok) {
                setShowNew(false);
                setToast('הסדרה החדשה התחילה 🏀');
              }
            })
          }
        />
      )}

      {error && <div className="rounded-xl border border-live/50 bg-live/10 px-3 py-2 text-sm">{error}</div>}

      {master && !showNew && (needPlayers || editPlayers) && (
        <Players
          key={`players-${series.teams.join()}`}
          series={series}
          onCancel={editPlayers && !needPlayers ? () => setEditPlayers(false) : null}
          onSave={(p) => run('players', p).then((ok) => ok && setEditPlayers(false))}
        />
      )}

      {ch ? (
        <Champion series={series} onNew={master && !showNew ? () => setShowNew(true) : null} />
      ) : !master ? (
        <ViewerNext series={series} />
      ) : (
        <NextGame key={`next-${series.teams.join()}`} series={series} busy={busy} onWin={(winner, pts) => run('game', { n, winner, pts })} />
      )}

      <Schedule series={series} />

      {confirm === 'logout' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm">
          לצאת ממצב מאסטר במכשיר הזה?
          <button className={btn} disabled={busy} onClick={() => run('logout').then(() => setConfirm(null))}>
            יציאה
          </button>
          <button className={btn} onClick={() => setConfirm(null)}>
            ביטול
          </button>
        </div>
      ) : !master ? null : confirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-live bg-live/10 px-3 py-2.5 text-sm">
          {confirm === 'undo' ? `למחוק את התוצאה של משחק ${n}?` : 'להתחיל את הסדרה הזאת מההתחלה? כל המשחקים שלה יימחקו.'}
          <button
            className={`${btn} border-live text-live`}
            disabled={busy}
            onClick={() => run(confirm, { n }).then(() => setConfirm(null))}
          >
            {confirm === 'undo' ? 'כן, למחוק' : 'כן, מההתחלה'}
          </button>
          <button className={btn} onClick={() => setConfirm(null)}>
            ביטול
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {n > 0 && (
            <button className={btn} onClick={() => setConfirm('undo')}>
              ↶ ביטול המשחק האחרון
            </button>
          )}
          {!needPlayers && (
            <button className={btn} onClick={() => setEditPlayers(true)}>
              ✎ שמות השחקנים
            </button>
          )}
          {!showNew && (
            <button className={btn} onClick={() => setShowNew(true)}>
              🏀 סדרה חדשה
            </button>
          )}
          {n > 0 && !ch && (
            <button className={`${btn} text-live`} onClick={() => setConfirm('reset')}>
              ↺ הסדרה מההתחלה
            </button>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">הלוגואים: NBA · מתעדכן אוטומטית בכל המכשירים</p>
    </main>
    <div className="lg:sticky lg:top-6">
      <Titles history={series.history} />
    </div>
    </div>
  );
}
