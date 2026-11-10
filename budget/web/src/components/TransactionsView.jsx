// ייבוא תנועות מקבצים של הבנק ושל חברות האשראי (מרכנתיל, מקס, כאל ועוד).
// הקבצים נקראים במכשיר בלבד. לפני הייבוא רואים כל תנועה: אפשר לבטל סימון, לשנות קטגוריה ולשנות את חודש החיוב.
import { useMemo, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { CATEGORIES, addMonths, money, monthName, thisMonth } from '../lib/budget';
import { readTables } from '../lib/tables';
import { buildCandidates, markExisting, rowMonth, ruleRecords, toRecords } from '../lib/transactions';
import { save } from '../lib/store';
import { Button, Segmented, inputCls } from './ui';

const HELP = [
  ['מרכנתיל (עו"ש)', 'באתר או באפליקציה של הבנק: עו"ש ← תנועות בחשבון ← בוחרים תקופה ← "ייצוא לאקסל".'],
  ['מקס', 'באתר מקס: "פירוט עסקאות" ← בוחרים חודש חיוב ← "ייצוא לאקסל".'],
  ['כאל', 'באתר כאל: "פירוט עסקאות" ← בוחרים חודש ← "ייצוא לאקסל" או "הורדה".'],
];

export default function TransactionsView({ data }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState('in');

  const cats = useMemo(() => [...new Set([...data.items.map((i) => i.category), ...CATEGORIES.expense, 'מסעדות ובילויים', 'ביגוד והנעלה', 'משיכת מזומן ועמלות'].filter(Boolean))], [data]);

  const pick = async (e) => {
    const list = [...(e.target.files || [])];
    e.target.value = '';
    if (!list.length) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const files = [];
      const problems = [];
      for (const f of list) {
        try {
          files.push({ name: f.name, sheets: await readTables(await f.arrayBuffer()) });
        } catch (err) {
          problems.push(err.code === 'old-xls' ? `"${f.name}" בפורמט xls ישן: לפתוח אותו באקסל, "שמירה בשם" ← xlsx, ולבחור שוב.` : `לא הצלחתי לקרוא את "${f.name}".`);
        }
      }
      const result = buildCandidates(files, data, { rules: data.rules });
      for (const f of result.files) if (!f.count) problems.push(`לא מצאתי טבלת תנועות ב-"${f.name}".`);
      setError(problems.join('\n'));
      if (result.rows.length) {
        setState({ ...result, original: new Map(result.rows.map((r) => [r.key, r.category])) });
        setShow('in');
      } else setState(null);
    } finally {
      setBusy(false);
    }
  };

  const setRow = (key, patch) => setState((s) => ({ ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const setFileMonth = (index, month) =>
    setState((s) => {
      const files = s.files.map((f) => (f.index === index ? { ...f, month } : f));
      const rows = s.rows.map((r) => ({ ...r }));
      markExisting(rows, files, data);
      return { ...s, files, rows };
    });

  const doImport = () => {
    const records = toRecords(state.rows, state.files);
    save([...records, ...ruleRecords(state.rows, state.original)]);
    const months = [...new Set(state.rows.filter((r) => r.include).map((r) => rowMonth(r, state.files)))].sort();
    setMsg(`יובאו ${records.length} תנועות${months.length ? ` (${months.map((m) => monthName(m)).join(', ')})` : ''}. אפשר לראות אותן בדוח החודשי.`);
    setState(null);
  };

  const rows = state?.rows || [];
  const chosen = rows.filter((r) => r.include);
  const shown = rows.filter((r) => (show === 'in' ? r.include : !r.include));
  const total = chosen.reduce((a, r) => a + (r.kind === 'income' ? 0 : r.refund ? -r.amount : r.amount), 0);
  const months = Array.from({ length: 25 }, (_, i) => addMonths(thisMonth(), i - 18));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <FileSpreadsheet className="text-accent" /> ייבוא תנועות מהבנק ומהאשראי
      </h1>
      <p className="mb-4 text-sm text-muted">
        מורידים קובץ תנועות מאתר הבנק או מחברת האשראי, ובוחרים אותו כאן (אפשר כמה קבצים יחד). הקובץ נקרא במכשיר בלבד ולא נשלח לשום מקום. לפני הייבוא רואים כל תנועה ואפשר לתקן.
      </p>

      {!state && (
        <>
          <label className={`mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 font-medium text-white ${busy ? 'opacity-60' : ''}`}>
            <Upload size={20} /> {busy ? 'קורא…' : 'בחירת קבצים'}
            <input type="file" multiple accept=".xlsx,.xls,.csv,.html,.htm" className="hidden" onChange={pick} disabled={busy} />
          </label>
          <section className="mb-4 rounded-2xl bg-card p-4 text-sm shadow-sm">
            <h2 className="mb-2 font-bold">איך מורידים את הקובץ</h2>
            <ul className="space-y-2">
              {HELP.map(([name, text]) => (
                <li key={name}>
                  <b>{name}:</b> {text}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              השמות של הכפתורים באתרים משתנים לפעמים – מחפשים "ייצוא", "הורדה" או סמל של אקסל. מה שכבר קיים באפליקציה (למשל משכנתא קבועה) וחיובי הכרטיסים בדף הבנק לא ייובאו פעמיים.
            </p>
          </section>
        </>
      )}

      {error && <p className="mb-4 rounded-xl bg-minus/10 p-3 text-sm whitespace-pre-line text-minus">{error}</p>}
      {msg && <p className="mb-4 rounded-xl bg-plus/10 p-3 text-sm text-plus">{msg}</p>}

      {state && (
        <>
          <div className="mb-4 space-y-2">
            {state.files
              .filter((f) => f.count)
              .map((f) => (
                <div key={f.index} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 text-sm shadow-sm">
                  <span className="font-bold">{f.issuer || (f.kind === 'card' ? 'כרטיס אשראי' : 'בנק')}</span>
                  <span className="text-muted">
                    {f.count} תנועות · {f.name}
                  </span>
                  {f.kind === 'card' && (
                    <label className="mr-auto flex items-center gap-2 whitespace-nowrap">
                      חיוב בחודש
                      <select className={`${inputCls} w-auto py-1.5`} value={f.month} onChange={(e) => setFileMonth(f.index, e.target.value)}>
                        {[...new Set([...months, f.month])].sort().map((m) => (
                          <option key={m} value={m}>
                            {monthName(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              ))}
          </div>

          <div className="mb-3">
            <Segmented
              value={show}
              onChange={setShow}
              options={[
                ['in', `לייבא (${chosen.length})`],
                ['out', `לא לייבא (${rows.length - chosen.length})`],
              ]}
            />
          </div>

          <datalist id="tx-cats">
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <ul className="mb-28 overflow-hidden rounded-2xl bg-card shadow-sm lg:mb-24">
            {shown.length === 0 && <li className="p-4 text-center text-sm text-muted">אין כאן תנועות</li>}
            {shown.map((r) => (
              <li key={r.key} className="flex items-start gap-3 border-b border-line px-3 py-3 last:border-0">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} aria-label="לייבא" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium break-words">{r.desc}</span>
                    <span className={`num shrink-0 font-medium ${r.kind === 'income' || r.refund ? 'text-plus' : ''}`}>
                      {r.kind === 'income' ? '+' : r.refund ? '-' : ''}
                      {money(r.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {[r.date.split('-').reverse().join('/'), r.payment, r.inst && `תשלום ${r.inst.index}/${r.inst.count}`, r.refund && 'זיכוי'].filter(Boolean).join(' · ')}
                  </div>
                  {r.reason && <div className="text-xs text-minus">{r.reason}</div>}
                  {r.include && (
                    <input
                      className={`${inputCls} mt-2 py-1.5 text-sm`}
                      list="tx-cats"
                      value={r.category}
                      placeholder="קטגוריה"
                      onChange={(e) => setRow(r.key, { category: e.target.value })}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-card/95 p-3 backdrop-blur lg:bottom-0 lg:mr-60">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <div className="flex-1 text-sm">
                <b>{chosen.length}</b> תנועות · הוצאות <span className="num font-bold">{money(total)}</span>
              </div>
              <Button kind="ghost" onClick={() => setState(null)}>
                ביטול
              </Button>
              <Button onClick={doImport} disabled={!chosen.length}>
                ייבוא
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
