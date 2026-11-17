// עלויות: היום, החודש, פירוק לפי בוט, ימים, וחודש קודם
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { agentRows, dayRows } from '../lib/costs';
import { dayLabel, ils, usd } from '../lib/format';

function Big({ label, value, rate }) {
  return (
    <div className="flex-1 rounded-2xl border border-line bg-card p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="num mt-1 text-3xl font-bold">{ils(value, rate)}</div>
      <div className="num text-sm text-muted">{usd(value)}</div>
    </div>
  );
}

export default function Costs({ agents }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/app/costs')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="m-4 text-bad">{error}</p>;
  if (!data) return <p className="p-8 text-center text-muted">רגע…</p>;
  const rate = data.ils;
  const rows = agentRows(data.now.agents, agents);
  const days = dayRows(data.now.days);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex gap-3">
        <Big label="היום" value={data.today} rate={rate} />
        <Big label="החודש" value={data.now.usd} rate={rate} />
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-bold">לפי בוט (החודש)</h2>
        {rows.length === 0 && <p className="text-sm text-muted">עוד אין הוצאות החודש.</p>}
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>
                  {r.emoji} {r.label}
                </span>
                <span className="num">
                  {ils(r.usd, rate)} <span className="text-muted">({usd(r.usd)})</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-bold">יום אחרי יום</h2>
        {days.length === 0 && <p className="text-sm text-muted">אין עדיין נתונים.</p>}
        <ul className="divide-y divide-line">
          {days.map((d) => (
            <li key={d.day} className="flex items-center justify-between py-2 text-sm">
              <span>{dayLabel(data.now.month, d.day)}</span>
              <span className="num">
                {ils(d.usd, rate)} <span className="text-muted">({usd(d.usd)})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.clipsLimit > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">סרטונים שנוצרו החודש</span>
            <span className="num font-bold">{data.now?.clips || 0}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            היום: {data.clipsToday || 0} מתוך {data.clipsLimit}. סרטונים מחויבים בחשבון Google, ולא נכללים בסכומים שלמעלה.
          </p>
        </section>
      )}

      <section className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 text-sm">
        <span className="text-muted">החודש שעבר</span>
        <span className="num font-bold">
          {ils(data.prev?.usd, rate)} <span className="font-normal text-muted">({usd(data.prev?.usd)})</span>
        </span>
      </section>
    </div>
  );
}
