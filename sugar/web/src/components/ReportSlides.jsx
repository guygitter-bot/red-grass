// שקופיות הדוח (16:9) – תצוגה במסך ו-PDF בהדפסה. כל שקופית מצוירת בגודל קבוע 1280×720 ומוקטנת לרוחב המסך,
// כך שהעיצוב זהה בטלפון, במחשב ובהדפסה. הצבעים קבועים (בהירים) גם במצב לילה – כמו מצגת אמיתית (המחלקה deck ב-index.css).
import { useEffect, useRef, useState } from 'react';
import { level } from '../lib/diary';
import { longDate } from '../lib/report';
import Markdown from './Markdown';

const W = 1280;
const H = 720;
const C = { low: '#dc2626', ok: '#16a34a', high: '#f59e0b', accent: '#1d5fa8', line: '#e1e7ef', muted: '#637083', ink: '#16202c' };
const lvColor = (v, s) => ({ low: C.low, ok: C.ok, high: C.high, veryHigh: C.low })[level(v, s)] || C.muted;

// הקטנה לרוחב המסגרת (בהדפסה – בלי הקטנה)
function useScale() {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return () => {};
    const ro = new ResizeObserver(([e]) => {
      setScale(e.contentRect.width / W);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);
  return [ref, scale];
}

function Slide({ r, n, total, title, children, cover = false }) {
  const [ref, scale] = useScale();
  return (
    <div ref={ref} className="slide-frame mb-4 overflow-hidden rounded-2xl shadow-md" style={{ aspectRatio: '16 / 9' }}>
      <div className="slide" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {cover ? (
          children
        ) : (
          <div className="flex h-full flex-col bg-white px-16 pt-12 pb-8 text-ink" dir="rtl">
            <div className="mb-6 flex items-center gap-4">
              <span className="h-10 w-2 rounded-full" style={{ background: C.accent }} />
              <h2 className="text-[40px] leading-tight font-bold">{title}</h2>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="mt-4 flex justify-between border-t border-line pt-3 text-[16px] text-muted">
              <span>
                יומן סוכר{r.person ? ` · ${r.person}` : ''} · {longDate(r.from)} – {longDate(r.to)}
              </span>
              <span className="num">
                {n} / {total}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Delta({ c, unit = '' }) {
  if (!c) return <span className="text-[18px] text-muted">אין השוואה</span>;
  if (!c.diff) return <span className="text-[18px] text-muted">ללא שינוי</span>;
  const color = c.better == null ? C.muted : c.better ? C.ok : C.low;
  return (
    <span className="num text-[20px] font-bold" style={{ color }} dir="ltr">
      {c.diff > 0 ? '▲' : '▼'} {Math.abs(c.diff)}
      {unit}
    </span>
  );
}

function Kpi({ label, value, unit = '', hint, c, color }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-line bg-page p-6">
      <div className="text-[22px] text-muted">{label}</div>
      <div className="num text-[64px] leading-none font-bold" style={{ color: color || C.ink }}>
        {value === '' || value == null ? '—' : value}
        <span className="text-[30px]">{value === '' || value == null ? '' : unit}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[16px] text-muted">{hint}</span>
        <Delta c={c} unit={unit} />
      </div>
    </div>
  );
}

// גרף קו: ממוצע לכל יום/שבוע/חודש, עם פס הטווח
function TrendChart({ r }) {
  const s = r.settings;
  const w = 1120;
  const h = 440;
  const P = { l: 60, r: 20, t: 20, b: 50 };
  const pts = r.trend.map((t, i) => ({ ...t, i })).filter((t) => t.mean !== '');
  const maxV = Math.max(260, ...pts.map((p) => p.mean)) + 20;
  const n = r.trend.length;
  const x = (i) => P.l + (n === 1 ? (w - P.l - P.r) / 2 : (i / (n - 1)) * (w - P.l - P.r));
  const y = (v) => P.t + (1 - v / maxV) * (h - P.t - P.b);
  const every = Math.ceil(n / 14);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" dir="ltr">
      <rect x={P.l} width={w - P.l - P.r} y={y(s.dayHigh)} height={y(s.low) - y(s.dayHigh)} fill={C.ok} opacity="0.1" />
      {[s.low, s.dayHigh, 250].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={w - P.r} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="2" />
          <text x={P.l - 10} y={y(v) + 6} textAnchor="end" fontSize="18" fill={C.muted}>
            {v}
          </text>
        </g>
      ))}
      {r.trend.map((t, i) =>
        i % every === 0 || i === n - 1 ? (
          <text key={i} x={x(i)} y={h - 14} textAnchor="middle" fontSize="16" fill={C.muted}>
            {t.label}
          </text>
        ) : null,
      )}
      {pts.length > 1 && <polyline points={pts.map((p) => `${x(p.i)},${y(p.mean)}`).join(' ')} fill="none" stroke={C.accent} strokeWidth="4" strokeLinejoin="round" />}
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.mean)} r={n > 40 ? 5 : 8} fill={lvColor(p.mean, s)} stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  );
}

// עמודות מוערמות: אחוז נמוך / בטווח / גבוה לכל קבוצת זמן
function TirBars({ r }) {
  const w = 1120;
  const h = 440;
  const P = { l: 50, r: 10, t: 10, b: 50 };
  const n = r.trend.length;
  const slot = (w - P.l - P.r) / n;
  const bw = Math.max(4, slot * 0.7);
  const y = (pct) => P.t + (1 - pct / 100) * (h - P.t - P.b);
  const every = Math.ceil(n / 14);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" dir="ltr">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={w - P.r} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="2" />
          <text x={P.l - 8} y={y(v) + 6} textAnchor="end" fontSize="16" fill={C.muted}>
            {v}%
          </text>
        </g>
      ))}
      {r.trend.map((t, i) => {
        const x0 = P.l + i * slot + (slot - bw) / 2;
        if (!t.count) return null;
        let acc = 0;
        return (
          <g key={i}>
            {[
              [t.low, C.low],
              [t.ok, C.ok],
              [t.high, C.high],
            ].map(([v, color], j) => {
              const top = y(acc + v);
              const height = y(acc) - top;
              acc += v;
              return v ? <rect key={j} x={x0} y={top} width={bw} height={height} fill={color} rx="2" /> : null;
            })}
          </g>
        );
      })}
      {r.trend.map((t, i) =>
        i % every === 0 || i === n - 1 ? (
          <text key={i} x={P.l + i * slot + slot / 2} y={h - 14} textAnchor="middle" fontSize="16" fill={C.muted}>
            {t.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// עמודות פשוטות (אינסולין לכל קבוצת זמן)
function Bars({ items, color = C.accent, unit = '' }) {
  const w = 1120;
  const h = 440;
  const P = { l: 50, r: 10, t: 30, b: 50 };
  const n = items.length;
  const max = Math.max(1, ...items.map((t) => Number(t.value) || 0)) * 1.15;
  const slot = (w - P.l - P.r) / n;
  const bw = Math.max(4, slot * 0.6);
  const y = (v) => P.t + (1 - v / max) * (h - P.t - P.b);
  const every = Math.ceil(n / 14);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" dir="ltr">
      <line x1={P.l} x2={w - P.r} y1={y(0)} y2={y(0)} stroke={C.line} strokeWidth="2" />
      {items.map((t, i) => {
        const x0 = P.l + i * slot + (slot - bw) / 2;
        return (
          <g key={i}>
            {t.value !== '' && t.value > 0 && <rect x={x0} y={y(t.value)} width={bw} height={y(0) - y(t.value)} fill={t.color || color} rx="3" />}
            {t.value !== '' && t.value > 0 && n <= 20 && (
              <text x={x0 + bw / 2} y={y(t.value) - 8} textAnchor="middle" fontSize="18" fontWeight="700" fill={C.ink}>
                {t.value}
                {unit}
              </text>
            )}
            {(i % every === 0 || i === n - 1) && (
              <text x={P.l + i * slot + slot / 2} y={h - 14} textAnchor="middle" fontSize="16" fill={C.muted}>
                {t.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const Empty = () => <p className="flex h-full items-center justify-center text-[28px] text-muted">אין נתונים בתקופה הזו</p>;

const KIND = { low: ['⚠️', C.low], high: ['📈', C.high], info: ['💡', C.accent], good: ['✅', C.ok] };

export default function ReportSlides({ r, ai, periodLabel }) {
  const s = r.settings;
  const k = r.kpis;
  const p = r.prevKpis;
  const has = k.count > 0;
  const unitName = { day: 'לפי ימים', week: 'לפי שבועות', month: 'לפי חודשים' }[r.unit];
  const slides = [];

  slides.push({
    cover: true,
    body: (
      <div className="flex h-full flex-col justify-between p-16 text-white" dir="rtl" style={{ background: `linear-gradient(135deg, ${C.accent}, #0e3a6b)` }}>
        <div className="text-[28px] opacity-80">💧 יומן סוכר</div>
        <div>
          <div className="text-[84px] leading-tight font-bold">דוח סוכר{r.person ? ` – ${r.person}` : ''}</div>
          <div className="mt-4 text-[40px] opacity-90">
            {periodLabel} · {longDate(r.from)} – {longDate(r.to)}
          </div>
        </div>
        <div className="flex justify-between text-[20px] opacity-80">
          <span>הופק ב-{longDate(new Date().toISOString().slice(0, 10))}</span>
          <span>טווח לאורך היום {s.low}-{s.dayHigh} · לפני ארוחה {s.low}-{s.high}</span>
        </div>
      </div>
    ),
  });

  slides.push({
    title: 'תמונת מצב',
    body: (
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-5">
        <Kpi label="זמן בטווח" value={k.inRange} unit="%" hint={`${s.low}-${s.dayHigh}`} c={r.changes.inRange} color={k.inRange >= 70 ? C.ok : k.inRange >= 50 ? C.high : C.low} />
        <Kpi label="סוכר ממוצע" value={k.mean} hint={`${k.count.toLocaleString('he-IL')} מדידות`} c={r.changes.mean} color={k.mean === '' ? C.ink : lvColor(k.mean, s)} />
        <Kpi label="מתחת לטווח" value={k.lowPct} unit="%" hint={`מתחת ל-${s.low}`} c={r.changes.lowPct} color={k.lowPct > 4 ? C.low : C.ok} />
        <Kpi label="תנודות (סטיית תקן)" value={k.sd} hint="ככל שנמוך – יציב יותר" c={r.changes.sd} />
        <Kpi label="GMI (הערכה)" value={k.gmi} unit="%" hint="הערכת המוגלובין מסוכרר" c={r.changes.gmi} />
        <Kpi label="אינסולין ליום" value={k.insulinPerDay} hint={`${k.meals} ארוחות נרשמו`} c={r.changes.insulinPerDay} color={C.accent} />
      </div>
    ),
  });

  slides.push({
    title: 'זמן בטווח – לעומת התקופה הקודמת',
    body: has ? (
      <div className="flex h-full flex-col justify-center gap-10">
        {[
          ['התקופה הזו', k, `${longDate(r.from)} – ${longDate(r.to)}`],
          ['התקופה הקודמת', p, `${longDate(r.prev.from)} – ${longDate(r.prev.to)}`],
        ].map(([label, x, dates]) => (
          <div key={label}>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[30px] font-bold">{label}</span>
              <span className="text-[20px] text-muted">{dates}</span>
            </div>
            {x.count ? (
              <div className="flex h-20 overflow-hidden rounded-2xl text-[24px] font-bold text-white" dir="ltr">
                {[
                  [x.lowPct, C.low, 'נמוך'],
                  [x.count ? Math.round(x.inRange) : 0, C.ok, 'בטווח'],
                  [x.highPct, C.high, 'גבוה'],
                ].map(([v, color, name]) =>
                  v > 0 ? (
                    <div key={name} className="flex items-center justify-center" style={{ width: `${v}%`, background: color }}>
                      {v >= 7 ? `${Math.round(v)}% ${name}` : ''}
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-2xl bg-page text-[22px] text-muted">אין נתונים</div>
            )}
          </div>
        ))}
        <div className="flex gap-8 text-[20px] text-muted">
          <span>
            <b style={{ color: C.low }}>■</b> מתחת ל-{s.low}
          </span>
          <span>
            <b style={{ color: C.ok }}>■</b> בטווח {s.low}-{s.dayHigh}
          </span>
          <span>
            <b style={{ color: C.high }}>■</b> מעל {s.dayHigh}
          </span>
        </div>
      </div>
    ) : (
      <Empty />
    ),
  });

  slides.push({ title: `הסוכר הממוצע ${unitName}`, body: has ? <TrendChart r={r} /> : <Empty /> });
  slides.push({ title: `זמן בטווח ${unitName}`, body: has ? <TirBars r={r} /> : <Empty /> });
  slides.push({
    title: 'לפי שעות היום',
    body: has ? <Bars items={r.dayParts.map((d) => ({ label: d.label, value: d.mean, color: d.mean === '' ? C.muted : lvColor(d.mean, s) }))} /> : <Empty />,
  });

  slides.push({
    title: 'ארוחות',
    body: r.meals.length ? (
      <table className="num w-full text-[22px]">
        <thead className="text-[18px] text-muted">
          <tr className="border-b-2 border-line">
            <th className="py-2 text-right font-normal">ארוחה</th>
            <th className="font-normal">פעמים</th>
            <th className="font-normal">מנות</th>
            <th className="font-normal">אינסולין</th>
            <th className="font-normal">לפני</th>
            <th className="font-normal">שעתיים אחרי</th>
            <th className="font-normal">בטווח</th>
            <th className="font-normal">נפילות</th>
          </tr>
        </thead>
        <tbody>
          {r.meals.map((m) => (
            <tr key={m.name} className="border-b border-line text-center">
              <td className="py-3 text-right font-bold">{m.name}</td>
              <td>{m.count}</td>
              <td>{m.portion}</td>
              <td className="font-bold">{m.dose === '' ? '—' : m.dose}</td>
              <td style={{ color: m.before === '' ? C.muted : lvColor(m.before, { ...s, dayHigh: s.high }) }}>{m.before === '' ? '—' : m.before}</td>
              <td style={{ color: m.after2h === '' ? C.muted : lvColor(m.after2h, s) }}>{m.after2h === '' ? '—' : m.after2h}</td>
              <td>{m.measured ? `${m.inRange}/${m.measured}` : '—'}</td>
              <td style={{ color: m.lows ? C.low : C.ink }}>{m.lows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <Empty />
    ),
  });

  slides.push({
    title: `אינסולין ממוצע ליום ${unitName}`,
    body: r.trend.some((t) => t.insulin !== '') ? <Bars items={r.trend.map((t) => ({ label: t.label, value: t.insulin }))} /> : <Empty />,
  });

  slides.push({
    title: 'מסקנות',
    body: r.findings.length ? (
      <ul className="space-y-3">
        {r.findings.slice(0, 7).map((f, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-page px-5 py-3 text-[22px] leading-snug" style={{ borderRight: `8px solid ${KIND[f.kind][1]}` }}>
            <span>{KIND[f.kind][0]}</span>
            <span>
              <b>{f.text}</b>
              {f.hint && <span className="block text-[18px] text-muted">{f.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="flex h-full items-center justify-center text-center text-[26px] text-muted">עוד אין מספיק נתונים למסקנות. כדאי לרשום ארוחות עם מדידה לפני ושעתיים אחרי.</p>
    ),
  });

  if (ai) slides.push({ title: 'סיכום והמלצות (AI)', body: <div className="report-ai h-full overflow-hidden text-[21px] leading-relaxed">{<Markdown text={ai} />}</div> });

  slides.push({
    title: 'לדיון עם הצוות הרפואי',
    body: (
      <div className="flex h-full flex-col justify-center gap-6 text-[28px] leading-relaxed">
        <p>הדוח מסכם את מה שנרשם ביומן ואת נתוני החיישן שהועלו. הוא נועד לעזור לראות דפוסים ולהביא שאלות לצוות.</p>
        <p className="font-bold">הוא לא הוראה רפואית – כל שינוי במינונים רק בהתייעצות עם הצוות.</p>
        <p className="text-[22px] text-muted">
          {r.sensorDays ? `${r.sensorDays} ימים בתקופה עם נתוני חיישן.` : 'בתקופה הזו אין נתוני חיישן – רק מדידות שהוקלדו.'} GMI הוא הערכה לפי הממוצע בלבד.
        </p>
      </div>
    ),
  });

  return (
    <div className="deck">
      {slides.map((sl, i) => (
        <Slide key={i} r={r} n={i + 1} total={slides.length} title={sl.title} cover={sl.cover}>
          {sl.body}
        </Slide>
      ))}
    </div>
  );
}

