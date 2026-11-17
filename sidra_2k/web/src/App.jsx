// "הסדרה" – סדרת פלייאוף ב-2K, אבא נגד הבן. מסך אחד: הלוח, המשחק הבא, לוח המשחקים וכלים.
import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import Schedule from './components/Schedule';
import Logo from './components/Logo';
import { HOME, TEAM, champion, other, wins } from './lib/series';
import { cached, call } from './lib/api';
import { confetti } from './lib/confetti';
import { getTheme, setTheme } from './lib/theme';

const btn = 'rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold hover:border-muted disabled:opacity-50';

// מי משחק עם איזו קבוצה
function Players({ players, onSave, onCancel }) {
  const [lal, setLal] = useState(players.LAL);
  const [sas, setSas] = useState(players.SAS);
  const row = (team, value, set, hint) => (
    <label className="grid grid-cols-[auto_1fr] items-center gap-3">
      <Logo team={team} className="h-10 w-10" />
      <input value={value} onChange={(e) => set(e.target.value)} maxLength={20} placeholder={hint} className="w-full rounded-lg border border-line bg-page px-3 py-2.5" />
    </label>
  );
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold bg-card p-4">
      <h3 className="text-lg font-black">מי משחק עם איזו קבוצה?</h3>
      {row('LAL', lal, setLal, 'מי משחק בלייקרס? (למשל: אבא)')}
      {row('SAS', sas, setSas, 'מי משחק בספרס? (למשל: הבן)')}
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg bg-gold px-4 py-2 font-black text-[#1b0d2e] disabled:opacity-50" disabled={!lal.trim() || !sas.trim()} onClick={() => onSave({ LAL: lal.trim(), SAS: sas.trim() })}>
          שמור
        </button>
        <button
          className={btn}
          onClick={() => {
            setLal(sas);
            setSas(lal);
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
  const home = HOME[n];
  const w = wins(series.games);
  const [pts, setPts] = useState({ LAL: '', SAS: '' });
  const who = (t) => series.players[t] || TEAM[t].short;
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4 lg:p-5">
      <div>
        <h3 className="text-xl font-black">
          משחק {n + 1}
          {w.LAL === 3 && w.SAS === 3 ? ' · משחק 7 המכריע!' : ''}
        </h3>
        <div className="text-sm text-muted">
          בבית של {TEAM[home].city} · {TEAM[other(home)].short} באים לבקר
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {['LAL', 'SAS'].map((t) => (
          <button
            key={t}
            disabled={busy}
            onClick={() => onWin(t, pts).then((ok) => ok && setPts({ LAL: '', SAS: '' }))}
            className={`pick-${t} flex items-center justify-center gap-2.5 rounded-xl px-2.5 py-3.5 text-[17px] font-black transition hover:-translate-y-0.5 disabled:opacity-60`}
          >
            <Logo team={t} className="h-9 w-9 shrink-0" />
            ניצח {who(t)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="w-full lg:w-auto">תוצאה (לא חובה):</span>
        {['LAL', 'SAS'].map((t) => (
          <label key={t} className="flex items-center gap-1.5">
            {TEAM[t].name}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="250"
              value={pts[t]}
              onChange={(e) => setPts({ ...pts, [t]: e.target.value })}
              className="num w-16 rounded-lg border border-line bg-page p-2 text-center text-base text-ink"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function Champion({ series }) {
  const ch = champion(series.games);
  const w = wins(series.games);
  return (
    <section className={`champ-${ch} flex flex-col items-center gap-2 rounded-2xl px-4 py-7 text-center`}>
      <div className="text-6xl leading-none">🏆</div>
      <Logo team={ch} className="h-20 w-20" />
      <div className="text-[clamp(26px,6vw,46px)] leading-tight font-black italic">{series.players[ch] || TEAM[ch].short} אלוף הסדרה!</div>
      <div className="font-semibold text-white">
        {TEAM[ch].city} {TEAM[ch].name} ניצחו {w[ch]}–{w[other(ch)]} ב-{series.games.length} משחקים
      </div>
      <button className="mt-1 rounded-lg border border-white/30 px-3.5 py-2 text-sm font-semibold text-white" onClick={() => confetti(ch)}>
        🎉 עוד קונפטי
      </button>
    </section>
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
    const w = wins(series.games);
    const p = prev.current;
    if (p) {
      if (w.LAL > p.LAL) setPopped('LAL');
      else if (w.SAS > p.SAS) setPopped('SAS');
      if (!p.ch && champion(series.games)) confetti(champion(series.games));
    }
    prev.current = { ...w, ch: champion(series.games) };
  }, [series.games]);

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

  const ch = champion(series.games);
  const needPlayers = !series.players.LAL || !series.players.SAS;
  const n = series.games.length;

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(32px,env(safe-area-inset-bottom))] lg:gap-5 lg:pt-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide text-muted">
          <span className="live num rounded bg-live px-2 py-0.5 text-xs tracking-[.12em] text-white">LIVE</span>
          פלייאוף 2K27 · אבא נגד הבן
        </div>
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
      </header>

      <Board series={series} popped={popped} />

      {error && <div className="rounded-xl border border-live/50 bg-live/10 px-3 py-2 text-sm">{error}</div>}

      {(needPlayers || editPlayers) && (
        <Players
          players={series.players}
          onCancel={editPlayers && !needPlayers ? () => setEditPlayers(false) : null}
          onSave={(p) => run('players', p).then((ok) => ok && setEditPlayers(false))}
        />
      )}

      {ch ? <Champion series={series} /> : <NextGame series={series} busy={busy} onWin={(winner, pts) => run('game', { n, winner, lal: pts.LAL, sas: pts.SAS })} />}

      <Schedule games={series.games} />

      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-live bg-live/10 px-3 py-2.5 text-sm">
          {confirm === 'undo' ? `למחוק את התוצאה של משחק ${n}?` : 'להתחיל סדרה חדשה? כל המשחקים יימחקו.'}
          <button
            className={`${btn} border-live text-live`}
            disabled={busy}
            onClick={() => run(confirm, { n }).then(() => setConfirm(null))}
          >
            {confirm === 'undo' ? 'כן, למחוק' : 'כן, סדרה חדשה'}
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
          {n > 0 && (
            <button className={`${btn} text-live`} onClick={() => setConfirm('reset')}>
              סדרה חדשה
            </button>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">הלוגואים: NBA · מתעדכן אוטומטית בכל המכשירים</p>
    </div>
  );
}
