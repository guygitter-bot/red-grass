import { useId } from 'react';

// חנוכייה ב-SVG. מרווח בין נרות 56; משבצת 0 = הכי ימנית. השמש באמצע (משבצת 4).
// candles: 8 מצבים ('none' | 'placed' | 'lit') – נר 1 = הימני ביותר. shamash: אותו דבר.
const SP = 56;
const slotX = (s) => 476 - s * SP;
const slotOf = (k) => (k <= 4 ? k - 1 : k); // נר 1-4 ימין, 5-8 שמאל (משבצת 4 = שמש)
const COLORS = ['#e8f1ff', '#ffd9a0', '#bfe0ff', '#ffc4b0'];

function Flame({ x, y, delay, grad }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle className="glow" r="30" cy="-14" fill={`url(#${grad})`} style={{ animationDelay: `${delay}s` }} />
      <g className="flame" style={{ animationDelay: `${delay}s` }}>
        <path d="M0,-30 C11,-15 11,-2 0,5 C-11,-2 -11,-15 0,-30Z" fill="#ff9a2e" />
        <path d="M0,-20 C6,-11 6,-3 0,2 C-6,-3 -6,-11 0,-20Z" fill="#fff1a8" />
      </g>
    </g>
  );
}

export default function Hanukkiah({ candles, shamash = 'none', interactive = false, onCandle, onShamash, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const grad = `g${uid}`;
  const press = (fn) => ({
    role: 'button',
    tabIndex: 0,
    style: { cursor: 'pointer' },
    onClick: fn,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
      }
    },
  });
  const BASE = 250; // גובה קו הבסיס
  const CH = 72; // גובה נר
  const SH_BASE = 190; // השמש יושב גבוה יותר

  const items = [];
  for (let k = 1; k <= 8; k++) {
    items.push({ k, x: slotX(slotOf(k)), top: BASE, state: candles[k - 1] || 'none', shamash: false });
  }
  items.push({ k: 'shamash', x: slotX(4), top: SH_BASE, state: shamash, shamash: true });

  return (
    <svg viewBox="0 0 504 300" className={className} role="img" aria-label="חנוכייה" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <radialGradient id={grad}>
          <stop offset="0%" stopColor="#ffd36a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffd36a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${grad}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#c98a1a" />
        </linearGradient>
      </defs>
      {/* גוף החנוכייה: קו בסיס, קנה אמצעי ורגל */}
      <rect x="14" y={BASE} width="476" height="14" rx="7" fill={`url(#${grad}m)`} />
      <rect x="244" y={SH_BASE} width="16" height={BASE - SH_BASE} fill={`url(#${grad}m)`} />
      <path d="M200 296 Q252 262 304 296 Z" fill={`url(#${grad}m)`} />
      <rect x="236" y="262" width="32" height="16" fill={`url(#${grad}m)`} />
      {items.map((it, i) => {
        const placed = it.state !== 'none';
        const lit = it.state === 'lit';
        const label = it.shamash ? 'שמש' : `נר ${it.k}`;
        const handler = it.shamash ? onShamash : () => onCandle && onCandle(it.k);
        return (
          <g key={it.k} {...(interactive ? press(handler) : {})} aria-label={interactive ? label : undefined}>
            {interactive && <rect x={it.x - SP / 2} y={it.top - 110} width={SP} height={140} fill="transparent" />}
            {/* כוסית */}
            <rect x={it.x - 12} y={it.top - 6} width="24" height="8" rx="3" fill={`url(#${grad}m)`} />
            {interactive && !placed && <rect x={it.x - 10} y={it.top - 64} width="20" height="58" rx="5" fill="none" stroke="#ffd36a" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 4" />}
            {placed && (
              <>
                <rect x={it.x - 8} y={it.top - CH} width="16" height={CH - 6} rx="3" fill={it.shamash ? '#ffe9b8' : COLORS[i % COLORS.length]} />
                <rect x={it.x - 1} y={it.top - CH - 7} width="2" height="8" fill="#5b4a3a" />
              </>
            )}
            {lit && <Flame grad={grad} x={it.x} y={it.top - CH - 6} delay={(i % 5) * 0.23} />}
          </g>
        );
      })}
    </svg>
  );
}
