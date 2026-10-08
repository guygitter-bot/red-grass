import { useEffect, useRef, useState } from 'react';
import { clock, longEnough, startsWithLetter } from '../lib/game';
import { chime } from '../lib/sound';
import { Avatar, Button, Card } from './ui';

// כמה הוזז המסך הנראה (באייפון, כשהמקלדת פתוחה, דברים "קבועים" בראש הדף בורחים למעלה)
function useViewportTop() {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setTop(Math.max(0, vv.offsetTop));
    on();
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, []);
  return top;
}

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
  const cardRef = useRef(null);
  const [cardHidden, setCardHidden] = useState(false);
  const viewportTop = useViewportTop();

  useEffect(() => {
    const id = setInterval(() => setT(now()), 250);
    return () => {
      clearInterval(id);
    };
  }, [now]);

  // מישהו סיים ראשון – צלצול נעים לכולם (פעם אחת)
  const first = round.first;
  const rang = useRef(!!first);
  useEffect(() => {
    if (first && !rang.current) {
      rang.current = true;
      chime();
    }
  }, [first]);
  const firstName = state.players.find((p) => p.id === first)?.name;

  const left = round.endsAt - t;
  const before = t < round.startsAt;
  const over = left <= 0;
  const locked = before || over || done;

  // כשגוללים והכרטיס הגדול של השעון יוצא מהמסך – מציגים שעון קטן שתמיד צמוד למעלה
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(([e]) => setCardHidden(!e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [before]);

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
    const bonus = round.first ? '' : ' (בונוס לראשון רק עם כל השדות מלאים)';
    if (empty && !window.confirm(`נשארו ${empty} שדות ריקים${bonus}. לסיים בכל זאת?`)) return;
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
  const percent = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="flex flex-col gap-4 pb-28">
      {cardHidden && (
        <div className="fixed inset-x-0 top-0 z-20 px-3 pt-2" style={{ transform: `translateY(${viewportTop}px)` }}>
          <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl border border-line bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-2xl font-extrabold text-white">{round.letter}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
              <div className={`h-full rounded-full transition-[width] duration-300 ${urgent ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
            </div>
            <span dir="ltr" className={`text-2xl font-bold tabular-nums ${urgent ? 'animate-pulse text-red-600 dark:text-red-400' : ''}`}>
              {clock(left)}
            </span>
          </div>
        </div>
      )}
      <div ref={cardRef}>
        <Card className="flex items-center gap-4">
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
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {state.players.map((p) => (
                <span key={p.id} className="relative" title={p.done ? `${p.name} סיים/ה` : p.name}>
                  <Avatar player={p} size={26} />
                  {p.done && <span className="absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-xs text-white">✓</span>}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {first && (
        <div className="pop rounded-2xl bg-soft px-4 py-2 text-center font-medium text-accent-ink">
          🏁 {first === state.me ? 'סיימת ראשון/ה! (בונוס +10 אם רוב התשובות נכונות)' : `${firstName} סיים/ה ראשון/ה!`}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {state.categories.map((c, i) => {
          const value = answers[c.id] || '';
          const wrong = value.trim() && !startsWithLetter(value, round.letter);
          const short = value.trim() && !wrong && !longEnough(value);
          return (
            <label key={c.id} className="block">
              <span className="mb-1 block text-lg font-bold">{c.label}</span>
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
              {short && <span className="mt-1 block text-sm text-muted">צריך מילה שלמה, לא רק אות</span>}
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
