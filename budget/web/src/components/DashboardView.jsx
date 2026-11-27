// מסך הבית "סקירה": כותרת עם הסכום הראשי, ארבע אריחים, כמה עולה כל ספק, מה דחוף, לאן הולך הכסף וכמה חויב בכל חודש
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Sparkles, Upload } from 'lucide-react';
import { addMonths, byCategory, forecast, money, monthName, monthSummary, thisMonth } from '../lib/budget';
import { bySupplier, headline } from '../lib/insights';

const SHOWN = 12;
const KICKER = { price: 'שינוי תעריף', spike: 'עלייה חריגה', double: 'חיוב כפול', missing: 'לוודא', overlap: 'כפל כיסוי', ending: 'מסתיים', subscriptions: 'מנויים' };
// צבע לכל רמת דחיפות: מסגרת + כותרת קטנה
const LEVEL = {
  urgent: ['border-s-alert', 'text-alert'],
  check: ['border-s-amber', 'text-amber'],
  info: ['border-s-navy', 'text-muted'],
};
const catColor = (i) => `var(--cat-${i < 6 ? i + 1 : 7})`;

function Card({ title, hint, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-4 lg:p-5 ${className}`}>
      <h2 className="text-base font-bold">{title}</h2>
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone = '' }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3 lg:p-4">
      <div className="text-xs text-muted lg:text-sm">{label}</div>
      <div className={`num mt-0.5 text-2xl font-extrabold lg:text-3xl ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs leading-snug text-muted">{sub}</div>
    </div>
  );
}

// כמה עולה כל ספק: שורה לכל ספק עם פס יחסי
function SupplierList({ rows, total, colorOf }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const max = rows[0]?.total || 1;
  return (
    <Card title="כמה עולה כל ספק בחודש" hint="מהגדול לקטן. החץ מראה שינוי לעומת החודש הקודם.">
      {rows.length === 0 && <div className="py-6 text-center text-sm text-muted">אין הוצאות בחודש הזה.</div>}
      <ul className="space-y-3.5">
        {shown.map((r) => {
          const color = colorOf(r.category);
          const ch = r.change != null && Math.abs(r.change) >= 1 ? r.change : null;
          return (
            <li key={r.supplier}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-bold">{r.supplier}</span>
                <span className="num shrink-0 font-bold">{money(r.total)}</span>
              </div>
              <div className="my-1 h-1.5 rounded-full bg-soft">
                <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (r.total / max) * 100)}%`, background: color }} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate">
                    {r.category} · {r.lines.length === 1 ? 'שורה אחת' : `${r.lines.length} שורות`}
                  </span>
                </span>
                <span className="num flex shrink-0 items-center gap-2">
                  {ch != null && (
                    <span className={`font-medium ${ch > 0 ? 'text-alert' : 'text-plus'}`}>
                      {ch > 0 ? '↑' : '↓'} {money(Math.abs(ch))}
                    </span>
                  )}
                  <span>{total ? Math.round((r.total / total) * 100) : 0}%</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > SHOWN && (
        <button onClick={() => setAll(!all)} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-medium hover:bg-soft">
          {all ? 'הצג פחות' : `הצג הכול (${rows.length})`}
        </button>
      )}
    </Card>
  );
}

// דחוף לשים לב: כרטיס לכל ממצא
function Alerts({ list, open }) {
  return (
    <Card title="דחוף לשים לב" hint="חיוב כפול, שינוי תעריף, חיוב שלא הגיע ועוד.">
      {list.length === 0 && <div className="rounded-xl bg-soft py-6 text-center text-sm font-medium text-plus">אין ממצאים החודש ✓</div>}
      <ul className="space-y-2.5">
        {list.map((f) => {
          const [border, text] = LEVEL[f.level] || LEVEL.info;
          return (
            <li key={f.id}>
              <button onClick={open} className={`block w-full rounded-xl border border-line border-s-4 bg-page/60 p-3 text-right hover:bg-soft ${border}`}>
                <div className={`text-xs font-medium ${text}`}>
                  {KICKER[f.kind] || 'ממצא'}
                  {f.supplier ? ` · ${f.supplier}` : ''}
                </div>
                <div className="mt-0.5 font-bold leading-snug">{f.title}</div>
                <div className="mt-0.5 text-sm leading-snug text-muted">{f.text}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// עוגה לפי קטגוריה (עד 6 פלחים + "אחר") עם מקרא
function Donut({ slices, total }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Card title="לאן הולך הכסף" hint="ההוצאות של החודש לפי קטגוריה.">
      {total === 0 ? (
        <div className="py-6 text-center text-sm text-muted">אין הוצאות בחודש הזה.</div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
          <svg viewBox="0 0 140 140" className="w-40 shrink-0" role="img" aria-label="הוצאות לפי קטגוריה">
            <g transform="rotate(-90 70 70)">
              {slices.map((c) => {
                const len = (c.amount / total) * circ;
                const el = <circle key={c.category} cx="70" cy="70" r={r} fill="none" stroke={c.color} strokeWidth="18" strokeDasharray={`${Math.max(0, len - 2)} ${circ}`} strokeDashoffset={-acc} />;
                acc += len;
                return el;
              })}
            </g>
            <text x="70" y="68" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--color-ink)">
              {money(total)}
            </text>
            <text x="70" y="82" textAnchor="middle" fontSize="8" fill="var(--color-muted)">
              בחודש
            </text>
          </svg>
          <ul className="w-full min-w-0 flex-1 space-y-1.5">
            {slices.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                <span className="min-w-0 flex-1 truncate">{c.category}</span>
                <span className="num font-medium">{money(c.amount)}</span>
                <span className="num w-9 text-left text-xs text-muted">{Math.round((c.amount / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// עמודות של ההוצאות ב-4 החודשים האחרונים; החודש הנוכחי מודגש
function MonthBars({ rows, month, open }) {
  const max = Math.max(1, ...rows.map((r) => r.expense));
  return (
    <Card title="כמה חויב בכל חודש" hint="סך ההוצאות בארבעת החודשים האחרונים.">
      <div className="flex h-44 items-end justify-around gap-3" role="img" aria-label="הוצאות לפי חודש">
        {rows.map((r) => {
          const now = r.month === month;
          return (
            <button key={r.month} onClick={() => open(r.month)} title={`${monthName(r.month)}: ${money(r.expense)}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`num text-xs ${now ? 'font-bold' : 'text-muted'}`}>{money(r.expense)}</span>
              <span className="w-full max-w-14 rounded-t-md transition-opacity group-hover:opacity-100" style={{ height: `${Math.max(3, (r.expense / max) * 100)}%`, background: 'var(--color-navy)', opacity: now ? 1 : 0.35 }} />
              <span className={`text-xs ${now ? 'font-bold' : 'text-muted'}`}>{monthName(r.month, true)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Empty({ go }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center lg:p-10">
      <h2 className="text-xl font-bold">מתחילים?</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">עוד אין כאן הוצאות והכנסות. הדרך המהירה: לייבא תנועות מהבנק או מהאשראי, או לייבא את האקסל שלכם מההגדרות (&quot;ייבוא מקובץ אקסל&quot;).</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button onClick={() => go('transactions')} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-white">
          <Upload size={18} /> ייבוא תנועות
        </button>
        <button onClick={() => go('settings')} className="flex items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 font-medium hover:bg-soft">
          <FileSpreadsheet size={18} /> הגדרות
        </button>
        <button onClick={() => go('month')} className="rounded-full border border-line bg-card px-5 py-2.5 font-medium hover:bg-soft">
          להוסיף ידנית
        </button>
      </div>
    </div>
  );
}

export default function DashboardView({ data, month, go }) {
  const h = useMemo(() => headline(data, month), [data, month]);
  const suppliers = useMemo(() => bySupplier(data, month), [data, month]);
  const bank = useMemo(() => forecast(data, month, 1)[0]?.balance ?? null, [data, month]);
  const months = useMemo(() => forecast(data, addMonths(month, -3), 4), [data, month]);
  // קטגוריות לפי גודל: אותו צבע לאותה קטגוריה גם בעוגה וגם ברשימת הספקים
  const slices = useMemo(() => {
    const list = byCategory(monthSummary(data, month));
    const head = list.slice(0, 6).map((c, i) => ({ ...c, color: catColor(i) }));
    const rest = list.slice(6).reduce((a, c) => a + c.amount, 0);
    return rest > 0 ? [...head, { category: 'שאר', amount: rest, color: catColor(6) }] : head;
  }, [data, month]);
  const total = slices.reduce((a, c) => a + c.amount, 0);
  const colorOf = (cat) => slices.find((s) => s.category === cat)?.color || catColor(6);
  const now = thisMonth();
  const hasData = data.items.length > 0;

  const pill = 'flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-soft';
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => go('home', addMonths(month, -1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש קודם">
            <ChevronRight />
          </button>
          <div className="min-w-32 text-center font-bold">{monthName(month)}</div>
          <button onClick={() => go('home', addMonths(month, 1))} className="rounded-full p-2 hover:bg-soft" aria-label="חודש הבא">
            <ChevronLeft />
          </button>
          {month !== now && (
            <button onClick={() => go('home', now)} className="text-sm text-accent-ink underline">
              לחודש הנוכחי
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => go('ai')} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-page">
            <Sparkles size={16} /> שאל את Claude
          </button>
          <button onClick={() => go('transactions')} className={pill}>
            <Upload size={16} /> ייבוא תנועות
          </button>
          <button onClick={() => go('report', month)} className={pill}>
            <FileText size={16} /> דוח חודשי
          </button>
        </div>
      </div>

      {!hasData ? (
        <Empty go={go} />
      ) : (
        <>
          <h1 className="text-3xl leading-tight font-extrabold lg:text-4xl">
            <span className="num">{money(h.expense)}</span> בחודש על {h.suppliers} ספקים
            {h.urgent > 0 && <span className="text-alert"> · {h.urgent} דחופים</span>}
          </h1>
          <p className="num mt-2 mb-5 border-b border-line pb-4 text-sm text-muted">
            הכנסות {money(h.income)} · נשאר <span className={`font-medium ${h.net < 0 ? 'text-minus' : 'text-plus'}`}>{money(h.net, true)}</span>
            {bank != null && <> · יתרה צפויה בבנק {money(bank)}</>}
          </p>

          <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            <Tile label="סך הכל בחודש" value={money(h.expense)} sub={`${h.suppliers} ספקים`} />
            <Tile label="עליות מחיר" value={h.raises} sub="ספקים שהתייקרו" tone={h.raises ? 'text-alert' : ''} />
            <Tile label="לוודא" value={h.toCheck} sub="חיוב כפול או חיוב שלא הגיע" tone={h.toCheck ? 'text-amber' : ''} />
            <Tile label="נשאר החודש" value={money(h.net, true)} sub="הכנסות פחות הוצאות" tone={h.net < 0 ? 'text-minus' : 'text-plus'} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="order-2 min-w-0 lg:order-1">
              <SupplierList rows={suppliers} total={h.expense} colorOf={colorOf} />
            </div>
            <div className="order-1 min-w-0 lg:order-2">
              <Alerts list={h.findings} open={() => go('month', month)} />
            </div>
            <div className="order-3 min-w-0 space-y-4">
              <Donut slices={slices} total={total} />
              <MonthBars rows={months} month={month} open={(m) => go('home', m)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
