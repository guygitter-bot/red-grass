// חישובי הגרף (פונקציות טהורות, בלי React): מהנרות והתחזית לנתיבי SVG.
// נרות: [{ t (שניות), c }]. תחזית: forecast.horizons עם id/low/high/expected
const FORECAST_IDS = ['w1', 'm1', 'm3'];
// מיקום כל טווח בתוך אזור התחזית (0..1) – לא לפי זמן אמיתי, כדי שייראה טוב גם בגרף של חודש
const FORECAST_POS = { w1: 0.22, m1: 0.55, m3: 1 };

const f = (n) => Math.round(n * 10) / 10;

export function buildChart({ candles, forecast, width, height, pad = {} }) {
  const p = { top: 12, bottom: 22, left: 4, right: 4, ...pad };
  const pts = (candles || []).filter((c) => Number.isFinite(c.c));
  if (pts.length < 2 || width <= 0 || height <= 0) return null;

  const hz = FORECAST_IDS.map((id) => forecast?.horizons?.find((h) => h.id === id)).filter((h) => h && Number.isFinite(h.expected));
  const hasCone = hz.length > 0;
  const innerW = width - p.left - p.right;
  const histW = hasCone ? innerW * 0.74 : innerW;
  const fcW = hasCone ? innerW - histW : 0;

  let min = Math.min(...pts.map((c) => c.c));
  let max = Math.max(...pts.map((c) => c.c));
  for (const h of hz) {
    min = Math.min(min, h.low);
    max = Math.max(max, h.high);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const room = (max - min) * 0.06;
  min -= room;
  max += room;

  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const x = (t) => p.left + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * histW);
  const y = (v) => p.top + (1 - (v - min) / (max - min)) * (height - p.top - p.bottom);

  const points = pts.map((c) => ({ x: x(c.t), y: y(c.c), t: c.t, c: c.c }));
  const last = points[points.length - 1];
  const line = points.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join('');
  const base = height - p.bottom;
  const area = `${line}L${f(last.x)} ${f(base)}L${f(points[0].x)} ${f(base)}Z`;

  let cone = null;
  let expected = null;
  const fpoints = hz.map((h) => ({
    id: h.id,
    name: h.name,
    x: last.x + fcW * FORECAST_POS[h.id],
    expected: h.expected,
    low: h.low,
    high: h.high,
    ye: y(h.expected),
    yl: y(h.low),
    yh: y(h.high),
  }));
  if (hasCone) {
    const up = fpoints.map((q) => `L${f(q.x)} ${f(q.yh)}`).join('');
    const down = [...fpoints].reverse().map((q) => `L${f(q.x)} ${f(q.yl)}`).join('');
    cone = `M${f(last.x)} ${f(last.y)}${up}${down}Z`;
    expected = `M${f(last.x)} ${f(last.y)}${fpoints.map((q) => `L${f(q.x)} ${f(q.ye)}`).join('')}`;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => {
    const v = min + (max - min) * k;
    return { v, y: y(v) };
  });

  return { line, area, cone, expected, points, fpoints, last, yTicks, min, max, base, width, height, histEnd: last.x };
}

// הנקודה הקרובה ביותר לאורך x (חיפוש בינארי; הנקודות ממוינות לפי x)
export function nearestIndex(points, xPos) {
  if (!points.length) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < xPos) lo = mid;
    else hi = mid;
  }
  return Math.abs(points[lo].x - xPos) <= Math.abs(points[hi].x - xPos) ? lo : hi;
}
