// מסך הגרפים: SVG פשוט (בלי ספריית גרפים), הצבעים ממשתני CSS כדי שמצב לילה יעבוד
import { useMemo, useState } from 'react';
import { addMonths, byCategory, cardTable, endingSoon, forecast, money, monthName, monthSummary, thisMonth } from '../lib/budget';

// צבעים לקטגוריות וכרטיסים – נראים טוב על רקע בהיר וכהה
const PALETTE = ['#2a9d8f', '#e9a23b', '#e76f51', '#4f8fd6', '#9b6ee0', '#e0629f', '#7fb069', '#9aa0a6'];
const W = 360;

const compact = (n) => {
  const v = Math.abs(n);
  return v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(Math.round(v));
};

function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      {children}
    </section>
  );
}

// הכנסות מול הוצאות: 6 חודשים אחורה ו-6 קדימה, הכי מוקדם מימין
function IncomeExpense({ data, now }) {
  const rows = useMemo(() => forecast(data, addMonths(now, -6), 12), [data, now]);
  const [sel, setSel] = useState(now);
  const cur = rows.find((r) => r.month === sel) || rows[6];
  const H = 200;
  const top = 8;
  const bottom = 44;
  const hi = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense)));
  const lo = Math.min(0, ...rows.map((r) => r.net));
  const y = (v) => top + ((hi - v) / (hi - lo)) * (H - top - bottom);
  const step = (W - 12) / 12;
  const cx = (i) => W - 6 - step * (i + 0.5);
  const bw = step * 0.32;
  const netPath = rows.map((r, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)} ${y(r.net).toFixed(1)}`).join(' ');
  return (
    <Card title="הכנסות מול הוצאות" hint="חצי שנה אחורה וחצי שנה קדימה. הנקודה היא מה שנשאר בכל חודש. לוחצים על חודש לראות מספרים.">
      <div className="mb-2 min-h-10 text-sm">
        <b>{monthName(cur.month)}</b>
        <span className="num"> · הכנסות <span className="text-plus">{money(cur.income)}</span> · הוצאות <span className="text-minus">{money(cur.expense)}</span> · נשאר <b className={cur.net < 0 ? 'text-minus' : 'text-plus'}>{money(cur.net, true)}</b></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mx-auto max-w-xl" role="img" aria-label="הכנסות מול הוצאות לפי חודש">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
        {rows.map((r, i) => {
          const isNow = r.month === now;
          return (
            <g key={r.month} onClick={() => setSel(r.month)} onMouseEnter={() => setSel(r.month)} style={{ cursor: 'pointer' }}>
              {(isNow || r.month === sel) && <rect x={cx(i) - step / 2} y={top - 4} width={step} height={H - top - bottom + 6} rx="4" fill="var(--color-accent)" opacity={isNow ? 0.14 : 0.08} />}
              <rect x={cx(i) - bw - 0.5} y={y(r.income)} width={bw} height={Math.max(0, y(0) - y(r.income))} rx="1.5" fill="var(--color-plus)" />
              <rect x={cx(i) + 0.5} y={y(r.expense)} width={bw} height={Math.max(0, y(0) - y(r.expense))} rx="1.5" fill="var(--color-minus)" />
              <text x={cx(i)} y={H - bottom + 12} fontSize="8" textAnchor="end" fill={isNow ? 'var(--color-accent)' : 'var(--color-muted)'} fontWeight={isNow ? 700 : 400} transform={`rotate(-50 ${cx(i)} ${H - bottom + 12})`}>
                {monthName(r.month, true)}
              </text>
              <rect x={cx(i) - step / 2} y="0" width={step} height={H} fill="transparent" />
            </g>
          );
        })}
        <path d={netPath} fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="2 2" />
        {rows.map((r, i) => (
          <circle key={r.month} cx={cx(i)} cy={y(r.net)} r="2.5" fill="var(--color-accent)" stroke="var(--color-muted)" strokeWidth="0.5" />
        ))}
      </svg>
      <Legend items={[['הכנסות', 'var(--color-plus)'], ['הוצאות', 'var(--color-minus)'], ['נשאר', 'var(--color-accent)']]} />
    </Card>
  );
}

function Legend({ items }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// עוגה של ההוצאות לפי קטגוריה, לחודש לבחירה
function Donut({ data, now }) {
  const [month, setMonth] = useState(now);
  const slices = useMemo(() => {
    const list = byCategory(monthSummary(data, month));
    const head = list.slice(0, 7);
    const rest = list.slice(7).reduce((a, c) => a + c.amount, 0);
    return rest > 0 ? [...head, { category: 'אחר', amount: rest }] : head;
  }, [data, month]);
  const total = slices.reduce((a, c) => a + c.amount, 0);
  const options = Array.from({ length: 25 }, (_, i) => addMonths(now, i - 12));
  const r = 50;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Card title="לאן הולך הכסף" hint="ההוצאות של החודש לפי קטגוריה. אפשר לבחור חודש אחר.">
      <select value={month} onChange={(e) => setMonth(e.target.value)} className="mb-3 w-full rounded-xl border border-line bg-page px-3 py-2 text-base outline-none focus:border-accent lg:w-auto" aria-label="חודש">
        {options.map((m) => (
          <option key={m} value={m}>
            {monthName(m)}
          </option>
        ))}
      </select>
      {total === 0 ? (
        <div className="py-6 text-center text-sm text-muted">אין הוצאות בחודש הזה.</div>
      ) : (
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-center lg:gap-8">
          <svg viewBox="0 0 140 140" className="w-48 shrink-0" role="img" aria-label="הוצאות לפי קטגוריה">
            <g transform="rotate(-90 70 70)">
              {slices.map((c, i) => {
                const len = (c.amount / total) * circ;
                const el = (
                  <circle key={c.category} cx="70" cy="70" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 0.8)} ${circ}`} strokeDashoffset={-acc} />
                );
                acc += len;
                return el;
              })}
            </g>
            <text x="70" y="66" textAnchor="middle" fontSize="9" fill="var(--color-muted)">
              סה״כ הוצאות
            </text>
            <text x="70" y="82" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-minus)">
              {money(total)}
            </text>
          </svg>
          <ul className="w-full min-w-0 flex-1 lg:max-w-xs">
            {slices.map((c, i) => (
              <li key={c.category} className="flex items-center gap-2 border-b border-line py-1.5 text-sm last:border-0">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="min-w-0 flex-1 truncate">{c.category}</span>
                <span className="num font-medium">{money(c.amount)}</span>
                <span className="num w-10 text-left text-xs text-muted">{Math.round((c.amount / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// יתרה צפויה בבנק ל-12 חודשים; החלק מתחת לאפס בצבע ההוצאה
function BalanceLine({ data, now }) {
  const rows = useMemo(() => forecast(data, now, 12), [data, now]);
  const vals = rows.map((r) => r.balance);
  const hint = 'איך היתרה בבנק צפויה להשתנות בשנה הקרובה, לפי ההכנסות וההוצאות שהוזנו.';
  if (vals.some((v) => v == null)) {
    return (
      <Card title="יתרה צפויה בבנק" hint={hint}>
        <div className="py-6 text-center text-sm text-muted">כדי לראות את הגרף – לקבוע יתרה בבנק בהגדרות</div>
      </Card>
    );
  }
  const H = 190;
  const top = 16;
  const bottom = 40;
  const hi = Math.max(0, ...vals);
  const lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const y = (v) => top + ((hi - v) / span) * (H - top - bottom);
  const step = (W - 24) / 11;
  const x = (i) => W - 12 - step * i;
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const z = y(0);
  return (
    <Card title="יתרה צפויה בבנק" hint={hint}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mx-auto max-w-xl" role="img" aria-label="יתרה צפויה בבנק לפי חודש">
        <defs>
          <clipPath id="bal-above">
            <rect x="0" y="0" width={W} height={z} />
          </clipPath>
          <clipPath id="bal-below">
            <rect x="0" y={z} width={W} height={H - z} />
          </clipPath>
        </defs>
        <line x1="0" x2={W} y1={z} y2={z} stroke="var(--color-muted)" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" clipPath="url(#bal-above)" />
        <path d={path} fill="none" stroke="var(--color-minus)" strokeWidth="2" strokeLinejoin="round" clipPath="url(#bal-below)" />
        {vals.map((v, i) => (
          <circle key={rows[i].month} cx={x(i)} cy={y(v)} r="2.5" fill={v < 0 ? 'var(--color-minus)' : 'var(--color-accent)'} />
        ))}
        {[0, 11].map((i) => (
          <text key={i} x={x(i)} y={y(vals[i]) - 7} fontSize="9" fontWeight="700" textAnchor={i === 0 ? 'end' : 'start'} fill={vals[i] < 0 ? 'var(--color-minus)' : 'var(--color-ink)'}>
            {money(vals[i])}
          </text>
        ))}
        {rows.map((r, i) => (
          <text key={r.month} x={x(i)} y={H - bottom + 12} fontSize="8" textAnchor="end" fill="var(--color-muted)" transform={`rotate(-50 ${x(i)} ${H - bottom + 12})`}>
            {monthName(r.month, true)}
          </text>
        ))}
      </svg>
    </Card>
  );
}

// חיובי כרטיסי אשראי בפועל: עמודות מוערמות לפי כרטיס, 18 חודשים אחרונים
function CardsChart({ data }) {
  const { names, rows: all } = useMemo(() => cardTable(data), [data]);
  if (!all.length) return null;
  const rows = all.slice(-18);
  const H = 210;
  const top = 16;
  const bottom = 44;
  const hi = Math.max(1, ...rows.map((r) => r.total));
  const y = (v) => top + ((hi - v) / hi) * (H - top - bottom);
  const step = (W - 12) / Math.max(rows.length, 6);
  const cx = (i) => W - 6 - step * (i + 0.5);
  const bw = step * 0.7;
  return (
    <Card title="כרטיסי אשראי בפועל" hint="כמה באמת חויב בכל כרטיס בכל חודש (מה שהוזן במעקב האשראי).">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mx-auto max-w-xl" role="img" aria-label="חיובי כרטיסי אשראי לפי חודש">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
        {[...rows].reverse().map((r, k) => {
          const i = rows.length - 1 - k;
          let acc = 0;
          return (
            <g key={r.month}>
              {names.map((n, j) => {
                const v = r.byName[n] || 0;
                if (v <= 0) return null;
                const el = <rect key={n} x={cx(i) - bw / 2} y={y(acc + v)} width={bw} height={y(acc) - y(acc + v)} fill={PALETTE[j % PALETTE.length]} />;
                acc += v;
                return el;
              })}
              <text x={cx(i)} y={y(r.total) - 3} fontSize="7" textAnchor="middle" fill="var(--color-ink)">
                {compact(r.total)}
              </text>
              <text x={cx(i)} y={H - bottom + 11} fontSize="8" textAnchor="end" fill="var(--color-muted)" transform={`rotate(-50 ${cx(i)} ${H - bottom + 11})`}>
                {monthName(r.month, true)}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend items={names.map((n, j) => [n, PALETTE[j % PALETTE.length]])} />
    </Card>
  );
}

// 10 ההוצאות הגדולות של החודש הנוכחי
function TopExpenses({ data, now }) {
  const lines = useMemo(
    () =>
      monthSummary(data, now)
        .lines.filter((l) => l.item.kind === 'expense' && l.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    [data, now],
  );
  const max = lines[0]?.amount || 1;
  return (
    <Card title="ההוצאות הגדולות החודש" hint={`עשר ההוצאות הגדולות ב${monthName(now)}.`}>
      {lines.length === 0 && <div className="py-4 text-center text-sm text-muted">אין הוצאות בחודש הזה.</div>}
      {lines.map((l) => (
        <div key={l.item.id} className="mb-2.5">
          <div className="flex justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{l.item.name}</span>
            <span className="num shrink-0 font-medium">{money(l.amount)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-soft">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (l.amount / max) * 100)}%`, background: 'var(--color-minus)', opacity: 0.8 }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

// תשלומים והלוואות שמסתיימים בקרוב
function Ending({ data, now }) {
  const list = useMemo(() => endingSoon(data, now, 6), [data, now]);
  const freed = list.reduce((a, e) => a + e.item.amount, 0);
  return (
    <Card title="תשלומים שמסתיימים בקרוב" hint="תשלומים והלוואות שנגמרים ב-6 החודשים הקרובים.">
      {list.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted">אין תשלומים שמסתיימים בקרוב.</div>
      ) : (
        <>
          <ul>
            {list.map((e) => (
              <li key={e.item.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.item.name}</div>
                  <div className="text-xs text-muted">אחרון ב{monthName(e.end)}</div>
                </div>
                <span className="num shrink-0 font-medium">{money(e.item.amount)} לחודש</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-accent-ink">
            בסך הכול יתפנו <b className="num">{money(freed)}</b> בחודש
          </p>
        </>
      )}
    </Card>
  );
}

export default function ChartsView({ data }) {
  const now = thisMonth();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">גרפים</h1>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-span-2">
          <IncomeExpense data={data} now={now} />
        </div>
        <Donut data={data} now={now} />
        <BalanceLine data={data} now={now} />
        <CardsChart data={data} />
        <TopExpenses data={data} now={now} />
        <Ending data={data} now={now} />
      </div>
    </div>
  );
}
