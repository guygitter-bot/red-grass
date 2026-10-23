import { useEffect, useState } from 'react';
import { LESSON_LIST } from '../lib/lessons';
import { getProgress } from '../lib/storage';
import { GUITAR_NAMES } from '../lib/parts';
import { IconTune, IconNext, IconLock, IconCheck } from '../components/Icons';

const CLASSICAL_ICON = (
  <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
    <g transform="rotate(-35 32 32)">
      <ellipse cx="32" cy="46" rx="14" ry="15" fill="#c98a43" />
      <ellipse cx="32" cy="32" rx="10" ry="10.500" fill="#c98a43" />
      <circle cx="32" cy="40" r="4.500" fill="#2a170b" />
      <rect x="29.500" y="6" width="5" height="30" fill="#4a2c1a" />
      <rect x="28" y="1" width="8" height="10" rx="2" fill="#3a2214" />
    </g>
  </svg>
);
const ELECTRIC_ICON = (
  <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
    <g transform="rotate(-35 32 32)">
      <path d="M20 40c0-5 4-6 7-8h10c3 2 7 3 7 8 0 7-5 14-12 14s-12-7-12-14z" fill="#b3261e" />
      <rect x="29.500" y="6" width="5" height="28" fill="#d8a964" />
      <rect x="28" y="1" width="8" height="10" rx="2" fill="#d8a964" />
      <rect x="27" y="42" width="10" height="3" fill="#f3efe6" />
    </g>
  </svg>
);

export default function Home({ type, onType }) {
  const [progress, setProgress] = useState({});
  useEffect(() => {
    setProgress(getProgress());
  }, []);

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 pb-8 pt-2">
      <p className="m-0 mb-4 text-[17px] leading-snug text-muted">
        לומדים גיטרה לבד, בעברית, צעד אחר צעד. מורה בתלת־ממד מנגן, מראה בתקריב איפה שמים את האצבעות, ואפשר גם לכוון את הגיטרה בטלפון.
      </p>

      <h2 className="mb-2 mt-5 font-display text-lg font-bold">על איזו גיטרה לומדים?</h2>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="סוג הגיטרה">
        {['classical', 'electric'].map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => onType(t)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center font-bold ${type === t ? 'border-accent bg-soft' : 'border-line bg-card'} text-ink`}
          >
            {t === 'classical' ? CLASSICAL_ICON : ELECTRIC_ICON}
            <span className="text-base">{GUITAR_NAMES[t]}</span>
            <span className="text-[13px] font-normal text-muted">{t === 'classical' ? 'מיתרי ניילון, צליל חם' : 'מיתרי פלדה, צליל בהיר'}</span>
          </button>
        ))}
      </div>

      <a href="#/tuner" className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-ink no-underline hover:border-accent">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft text-accent"><IconTune width={22} height={22} /></span>
        <span className="flex-1">
          <b className="block font-display text-base">מכוון</b>
          <span className="text-sm text-muted">מכוונים את הגיטרה עם המיקרופון של הטלפון</span>
        </span>
        <IconNext className="text-muted" />
      </a>

      <h2 className="mb-2 mt-6 font-display text-lg font-bold">שיעורים</h2>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {LESSON_LIST.map((l) => {
          const done = !!progress[l.id];
          const inner = (
            <>
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-full font-display font-bold ${l.open ? 'bg-accent text-accent-ink' : 'bg-line text-muted'}`}>
                {done ? <IconCheck /> : l.id}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-display text-base">{l.title}</b>
                <span className="text-sm text-muted">{done ? 'סיימתם' : l.sub}</span>
              </span>
              {l.open ? <IconNext className="text-muted" /> : <span className="flex items-center gap-1 rounded-full bg-line px-2.5 py-1 text-xs font-bold text-muted"><IconLock width={13} height={13} />בקרוב</span>}
            </>
          );
          return (
            <li key={l.id}>
              {l.open ? (
                <a href={`#/lesson/${l.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-ink no-underline hover:border-accent">{inner}</a>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-card/60 p-3.5 opacity-80" aria-disabled="true">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
