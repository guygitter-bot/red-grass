import { useEffect, useRef, useState } from 'react';
import { JOKER_EVERY, SNIPPET, SNIPPET_LONG, TEAMS, eraLabel } from '../lib/game';
import { audioLocked, isPlaying, loadSong, onAudioChange, playSong, stopSong, unlockAudio } from '../lib/audio';
import { Avatar, Button, Card } from './ui';

// "השעון" של המסך – מתעדכן כמה פעמים בשנייה
function useNow(now) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => {
      clearInterval(t);
    };
  }, []);
  return now();
}

function usePlaying() {
  const [playing, set] = useState(isPlaying);
  const [locked, setLocked] = useState(audioLocked);
  useEffect(() => {
    return onAudioChange(() => {
      set(isPlaying());
      setLocked(audioLocked());
    });
  }, []);
  return [playing, locked];
}

function Equalizer({ on }) {
  return (
    <div className={`eq text-accent ${on ? '' : 'still'}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// טבלת ניקוד קצרה (או ניקוד הקבוצות)
export function Scores({ state, compact = false }) {
  if (state.teams) {
    return (
      <div className="flex justify-center gap-3">
        {state.teams.map((t) => (
          <div key={t.team} className={`rounded-2xl px-4 py-2 text-center text-white ${TEAMS[t.team].bg}`}>
            <div className="text-sm">{TEAMS[t.team].name}</div>
            <div className="text-2xl font-extrabold">{t.total}</div>
          </div>
        ))}
      </div>
    );
  }
  const sorted = [...state.players].sort((a, b) => b.total - a.total);
  return (
    <div className={`flex flex-wrap justify-center gap-2 ${compact ? 'text-sm' : ''}`}>
      {sorted.map((p) => (
        <div key={p.id} className={`flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-1 pl-3 ${p.id === state.me ? 'ring-2 ring-accent' : ''}`}>
          <Avatar player={p} size={28} />
          <span className="max-w-24 truncate">{p.name}</span>
          <b>{p.total}</b>
        </div>
      ))}
    </div>
  );
}

// שאלה אחת: ספירה לאחור, השיר, ארבע תשובות, ואחר כך התשובה הנכונה
export default function Question({ state, act, now }) {
  const g = state.game;
  const t = useNow(now);
  const [playing, locked] = usePlaying();
  const [chosen, setChosen] = useState(g.mine.c);
  const [busy, setBusy] = useState(false);
  const played = useRef(false);
  const revealPlayed = useRef(false);
  const me = state.players.find((p) => p.id === state.me);
  const reveal = state.phase === 'reveal' ? g.reveal : null;
  const started = t >= g.startsAt;
  const answered = chosen !== null || g.mine.c !== null;
  const mine = g.mine.c ?? chosen;
  const seconds = g.mine.ext ? SNIPPET_LONG : SNIPPET;
  const left = Math.max(0, g.endsAt - t);

  // טעינה מראש: השיר הזה והבא
  useEffect(() => {
    loadSong(g.audio).catch(() => {});
    if (g.next) loadSong(g.next).catch(() => {});
  }, [g.audio, g.next]);

  // השיר מתחיל לבד כשהשאלה מתחילה
  useEffect(() => {
    if (reveal || played.current) return undefined;
    const wait = Math.max(0, g.startsAt - now());
    const timer = setTimeout(async () => {
      played.current = true;
      await playSong(g.audio, 0, seconds);
    }, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [g.audio, g.startsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // בתשובה הנכונה – ממשיכים לשמוע את השיר
  useEffect(() => {
    if (!reveal || revealPlayed.current) return;
    revealPlayed.current = true;
    playSong(g.audio, SNIPPET_LONG, 6);
  }, [reveal, g.audio]);

  useEffect(() => {
    return () => {
      stopSong();
    };
  }, []);

  const replay = () => {
    unlockAudio();
    playSong(g.audio, 0, seconds);
  };

  const extend = async () => {
    unlockAudio();
    setBusy(true);
    try {
      await act('/extend', { q: g.q });
      playSong(g.audio, 0, SNIPPET_LONG);
    } catch {
      // הזמן נגמר
    }
    setBusy(false);
  };

  const fifty = async () => {
    setBusy(true);
    await act('/fifty', { q: g.q }).catch(() => {});
    setBusy(false);
  };

  const answer = async (i) => {
    if (answered || reveal) return;
    setChosen(i);
    try {
      await act('/answer', { q: g.q, choice: i });
    } catch (e) {
      if (!e.data?.late) setChosen(null);
    }
  };

  // לפני שהשאלה מתחילה – ספירה לאחור
  if (!started && !reveal) {
    const n = Math.max(1, Math.ceil((g.startsAt - t) / 1000));
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <div className="text-muted">
          שאלה {g.q + 1} מתוך {g.count}
        </div>
        <div key={n} className="pop text-8xl font-extrabold text-accent-ink">
          {n}
        </div>
        <p className="text-muted">מקשיבים... 🎧</p>
        {locked && (
          <Button className="text-lg" onClick={unlockAudio}>
            🔊 לחצו כאן כדי שיהיה קול
          </Button>
        )}
        <div className="mt-6 w-full">
          <Scores state={state} compact />
        </div>
      </div>
    );
  }

  const answeredCount = state.players.filter((p) => p.answered).length;
  const cut = g.mine.cut || [];
  const toJoker = JOKER_EVERY - (me.total % JOKER_EVERY);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted">
          שאלה {g.q + 1} מתוך {g.count}
        </div>
        <div className="mr-auto text-sm">
          הניקוד שלך: <b className="text-lg">{me.total}</b>
        </div>
      </div>

      {/* הזמן שנשאר */}
      {!reveal && (
        <div className="h-3 overflow-hidden rounded-full bg-soft">
          <div className={`h-full rounded-full transition-all duration-200 ${left < 8000 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${(left / 30000) * 100}%` }} />
        </div>
      )}

      {reveal ? (
        <Card className="pop flex items-center gap-4">
          {reveal.song.art ? (
            <img src={reveal.song.art} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-soft text-4xl">🎵</div>
          )}
          <div className="min-w-0">
            <div className="text-sm text-muted">{mine === reveal.correct ? '🎉 נכון!' : mine === null ? '⏰ לא הספקת' : '😅 לא נכון'} – השיר היה:</div>
            <div className="text-xl font-extrabold">{reveal.song.title}</div>
            <div className="text-muted">
              {reveal.song.artist} · {eraLabel(reveal.song.decade)}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 text-center">
          <Equalizer on={playing} />
          <div className="text-sm text-muted">
            {Math.ceil(left / 1000)} שניות לענות · שומעים {seconds} שניות
          </div>
          {locked && (
            <Button className="text-lg" onClick={replay}>
              🔊 לחצו כדי לשמוע
            </Button>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button kind="secondary" className="px-3 py-2 text-sm" onClick={replay}>
              🔁 לשמוע שוב
            </Button>
            {!g.mine.ext && !answered && (
              <Button kind="secondary" className="px-3 py-2 text-sm" onClick={extend} disabled={busy}>
                ⏩ הארכה ל-10 שניות (5 נק׳)
              </Button>
            )}
            {!answered && !g.mine.cut && me.jokers > 0 && (
              <Button className="bg-pink px-3 py-2 text-sm" onClick={fifty} disabled={busy}>
                ✂️ 50:50 ({me.jokers})
              </Button>
            )}
          </div>
          {!answered && !g.mine.cut && me.jokers === 0 && <div className="text-xs text-muted">עוד {toJoker} נקודות ל-✂️ 50:50</div>}
        </Card>
      )}

      {/* ארבע התשובות */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {g.options.map((o, i) => {
          const removed = cut.includes(i);
          let look = 'border-line bg-card hover:bg-soft';
          if (reveal && i === reveal.correct) look = 'border-good bg-good text-white';
          else if (reveal && i === mine) look = 'border-bad bg-bad text-white';
          else if (i === mine) look = 'border-accent bg-accent text-white';
          else if (removed || answered || reveal) look = 'border-line bg-card opacity-50';
          const who = reveal ? state.players.filter((p) => reveal.picks[p.id]?.c === i) : [];
          return (
            <button
              key={i}
              type="button"
              disabled={removed || answered || !!reveal}
              onClick={() => answer(i)}
              className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-right transition active:scale-[0.98] disabled:active:scale-100 ${look} ${removed ? 'line-through' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-lg leading-tight font-bold">{o.title}</div>
                <div className="text-sm opacity-80">{o.artist}</div>
              </div>
              {who.length > 0 && (
                <div className="flex -space-x-2 space-x-reverse">
                  {who.slice(0, 5).map((p) => (
                    <Avatar key={p.id} player={p} size={26} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!reveal && answered && (
        <div className="text-center text-muted">
          ✓ ענית! מחכים לשאר ({answeredCount}/{state.players.length})
        </div>
      )}

      {reveal && (
        <Card className="flex flex-col gap-2">
          <div className="font-bold">מי צדק?</div>
          <ul className="flex flex-col gap-1">
            {state.players.map((p) => {
              const r = reveal.picks[p.id] || {};
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <Avatar player={p} size={30} />
                  <span className="min-w-0 truncate">{p.name}</span>
                  {state.teams && <span>{TEAMS[p.team].icon}</span>}
                  <span className="mr-auto text-sm">
                    {r.pts ? `✅ +${r.pts}${r.ext ? ' (עם הארכה)' : ''}` : r.c === null || r.c === undefined ? '⏰' : '❌'}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2">
            <Scores state={state} compact />
          </div>
          <div className="text-center text-sm text-muted">{g.q + 1 < g.count ? 'השאלה הבאה מיד...' : 'עוד רגע – התוצאות!'}</div>
        </Card>
      )}
    </div>
  );
}
