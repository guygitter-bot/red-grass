// גרף קו עצמאי (SVG): מחיר, שטח, חרוט תחזית ובועית בריחוף/מגע
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildChart, nearestIndex } from '../lib/chart';
import { fmtDate, fmtPrice } from '../lib/format';

export default function Chart({ candles, forecast, currency = '' }) {
  const box = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const height = width && width < 520 ? 230 : 300;

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const chart = useMemo(() => buildChart({ candles, forecast, width, height }), [candles, forecast, width, height]);
  const up = chart ? chart.last.c >= chart.points[0].c : true;
  const color = up ? 'var(--color-up)' : 'var(--color-down)';

  // מציאת הנקודה לפי מיקום האצבע/העכבר
  const onMove = (e) => {
    if (!chart) return;
    const rect = box.current.getBoundingClientRect();
    // ב-RTL ה-SVG עדיין משמאל לימין (dir=ltr על האלמנט), אז X רגיל
    const x = e.clientX - rect.left;
    if (x > chart.histEnd + 6 && chart.fpoints.length) {
      let best = chart.fpoints[0];
      for (const q of chart.fpoints) if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q;
      setHover({ kind: 'forecast', ...best });
    } else {
      const i = nearestIndex(chart.points, x);
      if (i >= 0) setHover({ kind: 'past', ...chart.points[i] });
    }
  };

  const tip = hover && chart && {
    x: hover.x,
    y: hover.kind === 'past' ? hover.y : hover.ye,
    title: hover.kind === 'past' ? fmtDate(hover.t) : `תחזית: ${hover.name}`,
    value: hover.kind === 'past' ? fmtPrice(hover.c) : `${fmtPrice(hover.expected)} (${fmtPrice(hover.low)}–${fmtPrice(hover.high)})`,
  };

  return (
    <div ref={box} dir="ltr" className="relative w-full touch-pan-y select-none" style={{ height }}>
      {chart && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label="גרף מחיר"
        >
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.yTicks.map((t, i) => (
            <g key={i}>
              <line x1="0" x2={width} y1={t.y} y2={t.y} stroke="var(--color-line)" strokeWidth="1" />
              {i % 2 === 0 && <text x="6" y={t.y - 3} fontSize="10" fill="var(--color-muted)">{fmtPrice(t.v)}</text>}
            </g>
          ))}
          <path d={chart.area} fill="url(#area-fill)" />
          {chart.cone && (
            <>
              <line x1={chart.histEnd} x2={chart.histEnd} y1="8" y2={chart.base} stroke="var(--color-muted)" strokeDasharray="2 4" strokeWidth="1" />
              <path d={chart.cone} fill="var(--color-accent)" fillOpacity="0.14" stroke="var(--color-accent)" strokeOpacity="0.6" strokeDasharray="4 4" strokeWidth="1" />
              <path d={chart.expected} fill="none" stroke="var(--color-accent)" strokeDasharray="5 4" strokeWidth="1.8" />
              <text x={chart.histEnd + 6} y={chart.base + 14} fontSize="10" fill="var(--color-muted)">תחזית</text>
            </>
          )}
          <path d={chart.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={chart.last.x} cy={chart.last.y} r="3.5" fill={color} />
          {tip && (
            <>
              <line x1={tip.x} x2={tip.x} y1="8" y2={chart.base} stroke="var(--color-muted)" strokeWidth="1" />
              <circle cx={tip.x} cy={tip.y} r="4.5" fill="var(--color-card)" stroke={color} strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {tip && (
        <div
          dir="rtl"
          className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-lg border border-line bg-card px-2 py-1 text-xs shadow"
          style={{ left: Math.min(Math.max(tip.x, 70), width - 70), transform: 'translateX(-50%)' }}
        >
          <div className="text-muted">{tip.title}</div>
          <div className="font-bold"><bdi dir="ltr">{currency}{tip.value}</bdi></div>
        </div>
      )}
    </div>
  );
}
