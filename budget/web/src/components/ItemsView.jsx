// כל ההכנסות וההוצאות ברשימה אחת: מה פעיל עכשיו, מה עוד יתחיל ומה הסתיים
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { EVERY, lastMonth, money, monthName, monthsBetween, thisMonth } from '../lib/budget';
import ItemEditor from './ItemEditor';
import { Segmented, inputCls } from './ui';

function describe(item) {
  const end = lastMonth(item);
  if (item.type === 'once') return monthName(item.start);
  if (item.type === 'installments') return `${item.count} תשלומים · ${monthName(item.start)} – ${monthName(end)}`;
  return `${EVERY[item.every]} · מ${monthName(item.start)}${end ? ` עד ${monthName(end)}` : ''}`;
}

export default function ItemsView({ data }) {
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [show, setShow] = useState('now');
  const now = thisMonth();

  const groups = useMemo(() => {
    const text = q.trim();
    const list = data.items.filter((i) => !text || `${i.name} ${i.category} ${i.note}`.includes(text));
    const status = (i) => {
      const end = lastMonth(i);
      if (end && monthsBetween(end, now) > 0) return 'past';
      return 'now';
    };
    const shown = list.filter((i) => status(i) === show);
    return [
      ['הכנסות', shown.filter((i) => i.kind === 'income')],
      ['הוצאות קבועות', shown.filter((i) => i.kind === 'expense' && i.type === 'fixed')],
      ['תשלומים', shown.filter((i) => i.kind === 'expense' && i.type === 'installments')],
      ['חד־פעמיות', shown.filter((i) => i.kind === 'expense' && i.type === 'once')],
    ];
  }, [data, q, show, now]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">הכול</h1>
        <button onClick={() => setEdit({ kind: 'expense' })} className="flex items-center gap-1 rounded-xl bg-accent px-3 py-2 font-medium text-white">
          <Plus size={18} /> חדש
        </button>
      </div>
      <div className="mb-4 grid gap-2 lg:grid-cols-2">
        <div className="relative">
          <Search size={18} className="absolute top-3 right-3 text-muted" />
          <input className={`${inputCls} pr-9`} placeholder="חיפוש" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={show} onChange={setShow} options={[['now', 'פעילות ועתידיות'], ['past', 'הסתיימו']]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([title, list]) =>
          list.length ? (
            <section key={title} className="rounded-2xl bg-card shadow-sm">
              <h2 className="border-b border-line px-4 py-3 font-bold">
                {title} <span className="text-sm font-normal text-muted">({list.length})</span>
              </h2>
              <ul>
                {list.map((i) => (
                  <li key={i.id}>
                    <button onClick={() => setEdit({ item: i })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-right last:border-0 hover:bg-soft">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{i.name}</div>
                        <div className="truncate text-xs text-muted">{[i.category, describe(i)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className={`num shrink-0 font-medium ${i.kind === 'income' ? 'text-plus' : ''}`}>{money(i.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
      {groups.every(([, l]) => !l.length) && <p className="rounded-2xl bg-card p-6 text-center text-muted shadow-sm">{q ? 'לא נמצא' : 'אין כאן כלום עדיין'}</p>}
      {edit && <ItemEditor data={data} item={edit.item} kind={edit.kind} month={now} onClose={() => setEdit(null)} />}
    </div>
  );
}

