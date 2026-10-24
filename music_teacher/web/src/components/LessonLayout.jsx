import { useEffect, useRef, useState } from 'react';
import { IconBack, IconNext } from './Icons';

// מסגרת שיעור: במה בתלת־ממד + פאנל המורה (בועת דיבור, התקדמות, הקודם/הבא)
export default function LessonLayout({ stageNode, steps, idx, setIdx, title, say, tools, lastLabel = 'סיום', onFinish }) {
  const last = idx === steps.length - 1;
  // האזור הנגלל: אם יש עוד תוכן מתחת, מוצג מסנן עדין (רמז שאפשר לגלול) ורווח תחתון מעל כפתורי הקודם/הבא
  const scrollRef = useRef(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (ro) {
      ro.observe(el);
      Array.from(el.children).forEach((c) => ro.observe(c));
    }
    return () => {
      el.removeEventListener('scroll', check);
      if (ro) ro.disconnect();
    };
  }, [idx, tools]);
  useEffect(() => {
    // מעבר שלב: חוזרים לראש האזור
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [idx]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-4 pb-3 lg:grid lg:grid-cols-[minmax(380px,440px)_minmax(0,1fr)] lg:gap-4 lg:pb-4">
      <div className="order-1 flex min-h-[230px] flex-[0_0_42%] lg:order-2 lg:min-h-0 lg:flex-none">{stageNode}</div>
      <section aria-label="השיעור" className="order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-card lg:order-1">
        <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-4 pt-2.5 lg:gap-3 lg:px-5 lg:pt-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[13px] text-muted">
              <span>שלב {idx + 1} מתוך {steps.length}</span>
              <b className="font-display text-sm font-medium text-ink">{steps[idx].name}</b>
            </div>
            <div className="flex gap-1">
              {steps.map((s, n) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`לשלב ${n + 1}: ${s.name}`}
                  onClick={() => setIdx(n)}
                  className={`h-2.5 flex-1 rounded-full border-0 p-0 ${n === idx ? 'bg-accent' : n < idx ? 'bg-soft outline outline-1 -outline-offset-1 outline-accent' : 'bg-line'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <svg className="h-9 w-9 flex-none lg:h-11 lg:w-11" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="24" fill="var(--color-accent)" />
              <ellipse cx="24" cy="26" rx="10" ry="11.500" fill="var(--color-accent-ink)" />
              <circle cx="20.500" cy="24" r="1.400" fill="var(--color-accent)" />
              <circle cx="27.500" cy="24" r="1.400" fill="var(--color-accent)" />
              <path d="M19.500 30c2.500 2.200 6.500 2.200 9 0" stroke="var(--color-accent)" strokeWidth="1.600" fill="none" strokeLinecap="round" />
              <path d="M14 20c1-6 5-9 10-9s9 3 10 9c-4-3-8-4-10-4s-6 1-10 4z" fill="var(--color-accent-ink)" />
            </svg>
            <div className="relative min-w-0 flex-1 rounded-[4px_14px_14px_14px] border border-line bg-page px-3 py-2" aria-live="polite">
              <h2 className="m-0 mb-0.5 font-display text-base font-bold [text-wrap:balance] lg:text-[17px]">{title}</h2>
              <p className="m-0 text-[14.5px] leading-snug lg:text-[15.5px]">{say}</p>
            </div>
          </div>
          {tools}
        </div>
          {more && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-card to-transparent" />}
        </div>
        <div className="flex flex-none justify-between gap-2.5 border-t border-line bg-card px-4 py-2.5 lg:px-5 lg:py-3">
          <button type="button" className="btn flex-1 lg:max-w-[200px]" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>
            <IconBack width={16} height={16} />
            <span>הקודם</span>
          </button>
          {last ? (
            <button type="button" className="btn btn-primary flex-1 lg:max-w-[200px]" onClick={onFinish}>
              <span>{lastLabel}</span>
            </button>
          ) : (
            <button type="button" className="btn btn-primary flex-1 lg:max-w-[200px]" onClick={() => setIdx(idx + 1)}>
              <span>הבא</span>
              <IconNext width={16} height={16} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
