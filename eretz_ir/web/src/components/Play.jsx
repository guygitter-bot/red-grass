import { useEffect, useRef, useState } from 'react';
import { clock, startsWithLetter } from '../lib/game';
import { Avatar, Button, Card } from './ui';

// סיבוב: האות, השעון, ושמונה שדות. התשובות נשמרות בשרת תוך כדי כתיבה,
// וכשהזמן נגמר (או "סיימתי") נשלחות סופית.
export default function Play({ state, act, now }) {
  const round = state.round;
  const meDone = state.players.find((p) => p.id === state.me)?.done;
  const [answers, setAnswers] = useState(() => round.mine || {});
  const [done, setDone] = useState(!!meDone);
  const [t, setT] = useState(now);
  const [retry, setRetry] = useState(0);
  const latest = useRef(answers);
  const dirty = useRef(false);
  const sent = useRef(false);
  latest.current = answers;

  useEffect(() => {
    const id = setInterval(() => setT(now()), 250);
    return () => {
      clearInterval(id);
    };
  }, [now]);

  const left = round.endsAt - t;
  const before = t < round.startsAt;
  const over = left <= 0;
  const locked = before || over || done;

  const save = (final) => {
    dirty.current = false;
    return act('/answers', { round: round.n, answers: latest.current, done: final });
  };

  // שמירה שקטה שנייה אחרי שמפסיקים להקליד
  useEffect(() => {
    if (!dirty.current || locked) return;
    const id = setTimeout(() => {
      save(false).catch(() => {
        dirty.current = true;
      });
    }, 1200);
    return () => {
      clearTimeout(id);
    };
  }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps

  // שליחה סופית (ואם אין רשת – שוב בעוד שתי שניות)
  useEffect(() => {
    if (!(over || done) || sent.current) return;
    sent.current = true;
    if (over) navigator.vibrate?.(200);
    save(true).catch((e) => {
      if (e.data?.late) return;
      sent.current = false;
      setTimeout(() => setRetry((n) => n + 1), 2000);
    });
  }, [over, done, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (id, value) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [id]: value }));
  };

  const finish = () => {
    const empty = state.categories.filter((c) => !String(answers[c.id] || '').trim()).length;
    if (empty && !window.confirm(`נשארו ${empty} שדות ריקים. לסיים בכל זאת?`)) return;
    setDone(true);
  };

  if (before) {
    const n = Math.ceil((round.startsAt - t) / 1000);
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <div className="text-muted">סיבוב {round.n} מתחיל בעוד</div>
          <div key={n} className="pop text-8xl font-extrabold text-accent-ink">
            {n}
          </div>
        </div>
      </div>
    );
  }

  const urgent = left <= 10000 && !over;
  const total = round.endsAt - round.startsAt;
  return (
    <div className="flex flex-col gap-4 pb-28">
      <Card className="sticky top-2 z-10 flex items-center gap-4">
        <div className="pop grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-accent text-6xl font-extrabold text-white shadow">{round.letter}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">סיבוב {round.n}</span>
            <span dir="ltr" className={`text-3xl font-bold tabular-nums ${urgent ? 'animate-pulse text-red-600 dark:text-red-400' : ''}`}>
              {clock(left)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${urgent ? 'bg-red-500' : 'bg-accent'}`}
              style={{ width: `${Math.max(0, Math.min(100, (left / total) * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {state.players.map((p) => (
              <span key={p.id} className="relative" title={p.done ? `${p.name} סיים/ה` : p.name}>
                <Avatar player={p} size={26} />
                {p.done && <span className="absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] text-white">✓</span>}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {state.categories.map((c, i) => {
          const value = answers[c.id] || '';
          const wrong = value.trim() && !startsWithLetter(value, round.letter);
          return (
            <label key={c.id} className="block">
              <span className="mb-1 block font-bold">{c.label}</span>
              <input
                value={value}
                onChange={(e) => change(c.id, e.target.value)}
                disabled={locked}
                maxLength={40}
                autoFocus={i === 0}
                enterKeyHint="next"
                autoComplete="off"
                placeholder={`${c.label} ב-${round.letter}...`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.closest('.grid').querySelectorAll('input')[i + 1]?.focus();
                  }
                }}
                className={`w-full rounded-2xl border bg-card px-4 py-3 text-lg outline-none disabled:opacity-70 ${wrong ? 'border-red-400 focus:border-red-500' : 'border-line focus:border-accent'}`}
              />
              {wrong && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">צריך להתחיל באות {round.letter}</span>}
            </label>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          {over || done ? (
            <div className="py-2 text-center font-medium text-muted">{over ? '⏰ הזמן נגמר!' : '✓ סיימת!'} מחכים לכולם...</div>
          ) : (
            <Button className="w-full text-lg" onClick={finish}>
              ✋ סיימתי
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
