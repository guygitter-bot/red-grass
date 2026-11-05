// רכיבים קטנים של יומן הסוכר: ערך סוכר צבעוני, גרף יומי, מספר בשדה
import { level } from '../lib/diary';

export const LEVEL_CLS = {
  low: 'bg-low/15 text-low',
  ok: 'bg-ok/15 text-ok',
  high: 'bg-high/15 text-high',
  veryHigh: 'bg-low/15 text-low',
  '': 'bg-soft text-muted',
};

// ערך סוכר בצבע לפי הטווח (אדום נמוך, ירוק בטווח, כתום גבוה)
export function Glucose({ value, settings, small = false, label }) {
  const lv = level(value, settings);
  return (
    <span className={`num inline-flex items-center gap-1 rounded-lg font-bold ${small ? 'px-1.5 py-0.5 text-sm' : 'px-2 py-1'} ${LEVEL_CLS[lv]}`}>
      {label && <span className="text-xs font-normal opacity-80">{label}</span>}
      {value === '' ? '—' : value}
    </span>
  );
}

// גרף היום: כל המדידות לאורך 24 שעות, פס ירוק לטווח היעד וקווים מקווקווים לשעות הארוחות (SVG בלי ספרייה).
// cgm – מדידות החיישן ([דקה, ערך]): קו רציף בצבע לפי הטווח; המדידות הידניות – נקודות
export function DayChart({ points, meals, settings, cgm = [] }) {
  const W = 600;
  const H = 170;
  const P = { l: 34, r: 8, t: 10, b: 22 };
  const maxV = Math.max(300, ...points.map((p) => p.value), ...cgm.map((p) => p[1])) + 10;
  const xm = (m) => P.l + (m / 1440) * (W - P.l - P.r);
  const x = (t) => P.l + ((Number(t.slice(0, 2)) * 60 + Number(t.slice(3))) / 1440) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / maxV) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const color = (v) => ({ low: 'var(--color-low)', ok: 'var(--color-ok)', high: 'var(--color-high)', veryHigh: 'var(--color-low)' })[level(v, settings)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" dir="ltr" role="img" aria-label="גרף הסוכר היום">
      <rect x={P.l} width={W - P.l - P.r} y={y(settings.high)} height={y(settings.low) - y(settings.high)} fill="var(--color-ok)" opacity="0.12" />
      {[settings.low, settings.high, 250].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
          <text x={P.l - 4} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
            {v}
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={P.l + (h / 24) * (W - P.l - P.r)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
          {String(h).padStart(2, '0')}:00
        </text>
      ))}
      {meals.map((m) => (
        <g key={m.id}>
          <line x1={x(m.time)} x2={x(m.time)} y1={P.t} y2={H - P.b} stroke="var(--color-accent)" strokeDasharray="3 4" opacity="0.6" />
          <text x={x(m.time) + 3} y={P.t + 10} fontSize="11" fill="var(--color-accent-ink)">
            🍽{m.insulin !== '' ? ` ${m.insulin}` : ''}
          </text>
        </g>
      ))}
      {cgm.slice(1).map((p, i) => {
        const prev = cgm[i];
        // רווח של יותר מרבע שעה (החיישן התנתק) – בלי קו
        if (p[0] - prev[0] > 15) return null;
        return <line key={p[0]} x1={xm(prev[0])} y1={y(prev[1])} x2={xm(p[0])} y2={y(p[1])} stroke={color(p[1])} strokeWidth="2.5" strokeLinecap="round" />;
      })}
      {!cgm.length && points.length > 1 && <path d={line} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" opacity="0.6" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.time)} cy={y(p.value)} r="5" fill={color(p.value)} stroke="var(--color-card)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
