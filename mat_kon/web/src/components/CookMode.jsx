import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListChecks, Timer, X } from 'lucide-react';
import { findDurations, formatClock } from '../lib/timers';

// מצב בישול: המסך לא נכבה, שלב אחד בכל פעם בגדול, וטיימרים מהזמנים שכתובים בשלבים
export default function CookMode({ recipe, ingredients, onClose }) {
  const steps = useMemo(
    () => recipe.steps.flatMap((s) => s.items.map((text) => ({ text, section: s.title }))),
    [recipe.steps],
  );
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState([]); // {id, label, endsAt, done}
  const [now, setNow] = useState(Date.now());
  const wakeLock = useRef(null);

  // המסך נשאר דולק
  useEffect(() => {
    let cancelled = false;
    const lock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // לא נתמך / נדחה - ממשיכים בלי
      }
    };
    lock();
    const onVisible = () => !cancelled && lock();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock.current?.release?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // טיימר שהסתיים: צפצוף ורטט
  useEffect(() => {
    const finished = timers.filter((t) => !t.done && t.endsAt <= now);
    if (!finished.length) return;
    setTimers((list) => list.map((t) => (finished.some((f) => f.id === t.id) ? { ...t, done: true } : t)));
    beep();
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  }, [now, timers]);

  const step = steps[index];
  const durations = step ? findDurations(step.text) : [];
  const start = (d) => setTimers((list) => [...list, { id: `${Date.now()}`, label: d.label, endsAt: Date.now() + d.seconds * 1000, done: false }]);

  return (
    <div className="fixed inset-0 z-40 bg-stone-950 text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-2 px-3 h-14 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="סגירת מצב בישול">
          <X size={24} />
        </button>
        <div className="flex-1 truncate font-bold">{recipe.title}</div>
        <button onClick={() => setShowIngredients((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm">
          <ListChecks size={18} /> מצרכים
        </button>
      </div>

      {timers.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pb-2 shrink-0">
          {timers.map((t) => {
            const left = Math.max(0, (t.endsAt - now) / 1000);
            return (
              <button
                key={t.id}
                onClick={() => setTimers((list) => list.filter((x) => x.id !== t.id))}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 ${t.done ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}
                title="הסרת הטיימר"
              >
                <Timer size={15} /> {t.done ? `${t.label} – הזמן נגמר!` : formatClock(left)}
                <X size={14} className="opacity-70" />
              </button>
            );
          })}
        </div>
      )}

      {showIngredients ? (
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {ingredients.map((s, si) => (
            <div key={si} className="mb-4">
              {s.title && <h3 className="text-orange-300 font-bold mb-2">{s.title}</h3>}
              <ul className="space-y-2 text-xl leading-relaxed">
                {s.items.map((item, i) => <li key={i}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ) : step ? (
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col">
          <div className="text-orange-300 text-sm font-medium mb-3">
            שלב {index + 1} מתוך {steps.length}
            {step.section ? ` · ${step.section}` : ''}
          </div>
          <p className="text-3xl leading-snug font-medium flex-1">{step.text}</p>
          {durations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {durations.map((d) => (
                <button key={d.seconds} onClick={() => start(d)} className="rounded-2xl bg-orange-500 px-4 py-3 text-lg font-bold flex items-center gap-2">
                  <Timer size={20} /> טיימר {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="flex-1 p-6 text-xl">אין שלבי הכנה במתכון הזה.</p>
      )}

      {!showIngredients && steps.length > 0 && (
        <div className="flex gap-3 p-3 shrink-0">
          <button
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
            className="flex-1 rounded-2xl bg-white/10 py-4 text-lg font-bold flex items-center justify-center gap-1 disabled:opacity-30"
          >
            <ChevronRight size={22} /> הקודם
          </button>
          {index < steps.length - 1 ? (
            <button onClick={() => setIndex((i) => i + 1)} className="flex-1 rounded-2xl bg-orange-500 py-4 text-lg font-bold flex items-center justify-center gap-1">
              הבא <ChevronLeft size={22} />
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 rounded-2xl bg-emerald-600 py-4 text-lg font-bold">בתיאבון! 🎉</button>
          )}
        </div>
      )}
    </div>
  );
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5, 1].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    // בלי צליל
  }
}
