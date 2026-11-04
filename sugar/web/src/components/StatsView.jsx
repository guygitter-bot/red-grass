// מעקב ודפוסים: ממוצע, אחוז בטווח, נמוכים וגבוהים לתקופה; לפי שעות היום; לכל ארוחה – מה יצא אחרי;
// וממוצע לכל יום (לחיצה פותחת את היום).
import { useState } from 'react';
import { addDays, allPoints, byDayPart, dayLabel, level, patternsByMeal, stats } from '../lib/diary';
import { Segmented } from './ui';
import { Glucose } from './bits';

const BAR = { low: 'bg-low/60', ok: 'bg-ok/60', high: 'bg-high/60', veryHigh: 'bg-low/60' };
const TEXT = { low: 'text-low', ok: 'text-ok', high: 'text-high', veryHigh: 'text-low' };

function Tile({ label, value, hint, cls = '' }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num text-2xl font-bold ${cls}`}>{value === '' ? '—' : value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default function StatsView({ data, openDay }) {
  const [days, setDays] = useState(14);
  const s = data.settings;
  const st = stats(data, days, data.today);
  const parts = byDayPart(data, days, data.today);
  const pats = patternsByMeal(data, days, data.today);
  const maxPart = Math.max(s.high + 40, ...parts.map((p) => p.mean || 0));

  // ממוצע לכל יום
  const daily = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(data.today, -i);
    const vals = allPoints(data, d, d).map((p) => p.value);
    if (vals.length) daily.push({ d, mean: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), n: vals.length, low: vals.filter((v) => v < s.low).length, max: Math.max(...vals) });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-3 text-2xl font-bold">מעקב ודפוסים</h1>
      <div className="mb-4 max-w-md">
        <Segmented value={days} onChange={setDays} options={[[7, 'שבוע'], [14, 'שבועיים'], [30, 'חודש'], [90, '3 חודשים']]} />
      </div>

      {!st.count ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted shadow-sm">עוד אין מדידות בתקופה הזאת.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="בטווח" value={`${st.inRange}%`} hint={`${s.low}-${s.high} · ${st.count} מדידות`} cls={st.inRange >= 70 ? 'text-ok' : st.inRange >= 50 ? 'text-high' : 'text-low'} />
            <Tile label="ממוצע" value={st.mean} hint={`סטיית תקן ${st.sd}`} cls={TEXT[level(st.mean, s)]} />
            <Tile label="נמוכים" value={st.low} hint={`מתחת ל-${s.low}`} cls={st.low ? 'text-low' : 'text-ok'} />
            <Tile label="גבוהים" value={st.high} hint={`${st.veryHigh} מעל 250`} cls={st.high ? 'text-high' : 'text-ok'} />
          </div>
          <p className="mb-4 text-xs text-muted">
            הערכת המוגלובין מסוכרר לפי הממוצע (GMI): <b className="num">{st.gmi}%</b> – הערכה גסה בלבד, מדויקת רק עם הרבה מדידות (או חיישן). הבדיקה במעבדה קובעת.
          </p>

          <section className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-bold">לפי שעות היום</h2>
            <div className="space-y-2">
              {parts.map((p) => (
                <div key={p.label} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0">{p.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-page">
                    {p.count > 0 && <div className={`h-full rounded-full ${BAR[level(p.mean, s)]}`} style={{ width: `${(p.mean / maxPart) * 100}%` }} />}
                  </div>
                  <span className="num w-24 shrink-0 text-left">{p.count ? `${p.mean}` : '—'} <span className="text-xs text-muted">({p.count})</span></span>
                </div>
              ))}
            </div>
          </section>

          {pats.length > 0 && (
            <section className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-1 font-bold">לכל ארוחה</h2>
              <p className="mb-3 text-xs text-muted">ממוצעים בתקופה. "אחרי" = המדידה הקרובה לשעתיים אחרי הארוחה.</p>
              <div className="overflow-x-auto">
                <table className="num w-full min-w-[520px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="text-right font-normal">ארוחה</th>
                      <th className="font-normal">פעמים</th>
                      <th className="font-normal">מנות</th>
                      <th className="font-normal">אינסולין</th>
                      <th className="font-normal">לפני</th>
                      <th className="font-normal">אחרי</th>
                      <th className="font-normal">בטווח</th>
                      <th className="font-normal">נפילות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pats.map((p) => (
                      <tr key={p.key} className="border-t border-line text-center">
                        <td className="py-2 text-right font-medium">{p.name}</td>
                        <td>{p.count}</td>
                        <td>{p.portion}</td>
                        <td className="font-bold">{p.dose === '' ? '—' : p.dose}</td>
                        <td>{p.before === '' ? '—' : <Glucose value={p.before} settings={s} small />}</td>
                        <td>{p.after2h === '' ? '—' : <Glucose value={p.after2h} settings={s} small />}</td>
                        <td>{p.measured ? `${p.inRange}/${p.measured}` : '—'}</td>
                        <td className={p.lows ? 'font-bold text-low' : ''}>{p.lows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-bold">יום אחרי יום</h2>
            <div className="divide-y divide-line">
              {daily.map((x) => (
                <button key={x.d} onClick={() => openDay(x.d)} className="flex w-full items-center gap-3 py-2 text-right text-sm hover:bg-soft">
                  <span className="flex-1">{dayLabel(x.d, data.today)}</span>
                  <span className="text-xs text-muted">{x.n} מדידות</span>
                  {x.low > 0 && <span className="text-xs font-bold text-low">{x.low} נמוכים</span>}
                  <span className="text-xs text-muted">שיא {x.max}</span>
                  <Glucose value={x.mean} settings={s} small />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
