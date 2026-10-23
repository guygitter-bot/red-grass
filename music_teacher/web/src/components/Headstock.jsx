import { STRING_ORDER } from '../lib/notes';

// תרשים ראש הגיטרה (שטוח, מבט מלפנים): איזה מפתח שייך לאיזה מיתר
export default function Headstock({ type, active, detected }) {
  const classical = type === 'classical';
  // מיקום המפתחות: [מיתר]: [x, y]
  const pegs = {};
  if (classical) {
    // 3 מכל צד. מיתר 6 הכי קרוב לאום משמאל, מיתר 1 מימין
    [6, 5, 4].forEach((s, k) => (pegs[s] = [34, 196 - k * 44]));
    [1, 2, 3].forEach((s, k) => (pegs[s] = [146, 196 - k * 44]));
  } else {
    // שישה בשורה בצד שמאל. מיתר 1 הכי קרוב לאום
    for (let s = 1; s <= 6; s++) pegs[s] = [38, 204 - (s - 1) * 33];
  }
  const outline = classical
    ? 'M70 240 L110 240 L118 70 Q120 22 90 22 Q60 22 62 70 Z'
    : 'M72 240 L106 240 L112 128 Q118 70 108 36 Q96 10 70 22 Q50 34 54 86 Q56 130 72 150 Z';
  return (
    <svg viewBox="0 0 180 270" role="img" aria-label="תרשים ראש הגיטרה עם המפתחות" className="mx-auto block h-auto w-full max-w-[190px]">
      <rect x="76" y="240" width="28" height="30" rx="3" fill="var(--color-line)" />
      <rect x="72" y="236" width="36" height="6" rx="2" fill="var(--color-muted)" />
      <path d={outline} fill="var(--color-soft)" stroke="var(--color-muted)" strokeWidth="2.500" />
      {classical && (
        <>
          <rect x="74" y="60" width="10" height="150" rx="4" fill="var(--color-card)" stroke="var(--color-line)" />
          <rect x="96" y="60" width="10" height="150" rx="4" fill="var(--color-card)" stroke="var(--color-line)" />
        </>
      )}
      {STRING_ORDER.map((s) => {
        const [x, y] = pegs[s];
        const on = s === active;
        const heard = s === detected;
        // קו המיתר מהאום אל המפתח
        const nx = 90 + (s - 3.5) * -3.2;
        return (
          <g key={s}>
            <line x1={nx} y1="238" x2={classical ? (x < 90 ? 78 : 102) : 80} y2={y} stroke={on ? 'var(--color-accent)' : 'var(--color-muted)'} strokeWidth={on ? 3 : 1.400} opacity={on ? 1 : 0.55} />
            <line x1={x} y1={y} x2={x < 90 ? 62 : 118} y2={y} stroke="var(--color-muted)" strokeWidth="3" />
            <circle cx={x} cy={y} r={on ? 15 : 13} fill={on ? 'var(--color-accent)' : 'var(--color-card)'} stroke={heard || on ? 'var(--color-accent)' : 'var(--color-muted)'} strokeWidth="2.500" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="Rubik, sans-serif" fill={on ? 'var(--color-accent-ink)' : 'var(--color-ink)'}>{s}</text>
          </g>
        );
      })}
    </svg>
  );
}
