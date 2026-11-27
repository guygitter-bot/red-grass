// חשבוניות מהמייל: חיבור תיבות Gmail (סיסמת אפליקציה), בדיקה יומית אוטומטית או בלחיצה,
// והחשבוניות לפי ספק – כמה עלתה האחרונה, מה השתנה מהקודמת, הסעיפים וההיסטוריה. השרת: api/mail/
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { money, monthName, thisMonth } from '../lib/budget';
import { invoicesBySupplier } from '../lib/invoices';
import { api } from '../lib/api';
import { newId, remove, save, sync } from '../lib/store';
import { Button, inputCls } from './ui';

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '');
const ago = (t) => {
  if (!t) return 'עוד לא';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 2) return 'עכשיו';
  if (min < 60) return `לפני ${min} דקות`;
  if (min < 60 * 24) return `לפני ${Math.round(min / 60)} שעות`;
  return new Date(t).toLocaleDateString('he-IL');
};

function Guide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-xl bg-soft p-3 text-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between font-medium">
        איך יוצרים סיסמת אפליקציה (פעם אחת לכל תיבה)
        <ChevronDown size={18} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <ol className="mt-2 list-decimal space-y-1.5 pr-5">
          <li>
            מפעילים אימות דו-שלבי בחשבון גוגל:{' '}
            <a className="text-accent-ink underline" href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">
              אימות דו-שלבי
            </a>
          </li>
          <li>
            נכנסים ל-
            <a className="text-accent-ink underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              סיסמאות אפליקציה
            </a>
            , כותבים שם (למשל "תקציב הבית") ולוחצים "יצירה".
          </li>
          <li>מעתיקים את 16 האותיות שמופיעות, ומדביקים כאן למטה יחד עם כתובת המייל.</li>
          <li>אם החיבור נכשל: ב-Gmail ← הגדרות ← "העברה ו-POP/IMAP" ← לוודא ש-IMAP מופעל.</li>
        </ol>
      )}
    </div>
  );
}

function Mailboxes({ state, reload }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/mail/add', form);
      setForm({ email: '', password: '' });
      setMsg('התיבה חוברה ✓ הבדיקה הראשונה מתחילה עכשיו (חצי שנה אחורה, כמה דקות).');
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const drop = async (a) => {
    if (!confirm(`לנתק את ${a.email}? החשבוניות שכבר נאספו נשארות.`)) return;
    await api('/mail/remove', { id: a.id }).catch(() => {});
    reload();
  };

  return (
    <section className="mb-5 rounded-2xl border border-line bg-card p-4 lg:p-5">
      <h2 className="mb-1 font-bold">תיבות מייל מחוברות</h2>
      <p className="mb-3 text-xs text-muted">
        פעם ביום (וגם בלחיצה על "לבדוק עכשיו") האפליקציה מחפשת בתיבה מיילים של חשבוניות וקבלות. רק מיילים כאלה נקראים על ידי Claude כדי להוציא מהם ספק, סכום ותקופה. הסיסמה נשמרת מוצפנת בשרת ואפשר לבטל אותה בכל רגע בגוגל.
      </p>
      {state.accounts.map((a) => (
        <div key={a.id} className="mb-2 flex items-center gap-3 rounded-xl bg-page p-3">
          <Mail size={18} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium" dir="ltr" style={{ textAlign: 'right' }}>
              {a.email}
            </div>
            <div className={`text-xs ${a.lastError ? 'text-minus' : 'text-muted'}`}>{a.lastError || `בדיקה אחרונה: ${ago(a.lastRun)} · ${a.found || 0} חשבוניות`}</div>
          </div>
          <button onClick={() => drop(a)} className="rounded-full p-2 text-muted hover:bg-soft hover:text-minus" aria-label="ניתוק">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <form onSubmit={add} className="mt-3">
        <Guide />
        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <input className={inputCls} dir="ltr" type="email" placeholder="name@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          <input className={inputCls} dir="ltr" type="password" placeholder="סיסמת אפליקציה (16 אותיות)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <Button disabled={busy || !form.email || form.password.replace(/\s/g, '').length < 16}>{busy ? 'בודק…' : 'חיבור'}</Button>
        </div>
      </form>
      {msg && <p className="mt-3 rounded-xl bg-plus/10 p-3 text-sm text-plus">{msg}</p>}
      {error && <p className="mt-3 rounded-xl bg-minus/10 p-3 text-sm text-minus">{error}</p>}
    </section>
  );
}

function SupplierCard({ s }) {
  const [open, setOpen] = useState(false);
  const { last, change } = s;
  const toFixed = () => {
    save({ id: newId(), t: 'item', kind: 'expense', type: 'fixed', name: s.supplier, category: s.category, amount: last.amount, start: thisMonth(), every: s.gap > 45 ? 2 : 1, payment: 'חשבונית במייל', note: last.service });
    alert(`נוספה הוצאה קבועה: ${s.supplier}, ${money(last.amount)}`);
  };
  return (
    <article className="rounded-2xl border border-line bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-right">
        <div className="min-w-0 flex-1">
          <div className="font-bold">{s.supplier}</div>
          <div className="truncate text-xs text-muted">
            {[last.service, last.plan, `${s.invoices.length} חשבוניות`, `אחרונה ${fmtDate(last.date)}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="shrink-0 text-left">
          <div className="num font-bold">{money(last.amount)}</div>
          {change && Math.abs(change.pct) >= 1 && (
            <div className={`num text-xs font-medium ${change.diff > 0 ? 'text-alert' : 'text-plus'}`}>
              {change.diff > 0 ? '↑' : '↓'} {Math.abs(change.pct)}%
            </div>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-line p-4 text-sm">
          {last.notes && <p className="mb-3 rounded-xl bg-soft p-2">{last.notes}</p>}
          {last.items.length > 0 && (
            <>
              <h3 className="mb-1 font-medium">הסעיפים בחשבונית האחרונה</h3>
              <ul className="mb-3">
                {last.items.map((i) => (
                  <li key={i.name} className="flex justify-between border-b border-line py-1 last:border-0">
                    <span>{i.name}</span>
                    <span className="num">{money(i.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mb-1 font-medium">כל החשבוניות</h3>
          <ul className="mb-3">
            {s.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
                <span className="num w-20 shrink-0 text-muted">{fmtDate(inv.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {inv.periodFrom && inv.periodTo ? `${fmtDate(inv.periodFrom)}–${fmtDate(inv.periodTo)}` : inv.subject}
                  {inv.pdf && <FileText size={12} className="mr-1 inline" />}
                </span>
                <span className="num shrink-0">{money(inv.amount)}</span>
                <button
                  onClick={() => {
                    if (confirm('למחוק את החשבונית הזאת מהאפליקציה?')) remove(inv.id);
                  }}
                  className="rounded-full p-1 text-muted hover:text-minus"
                  aria-label="מחיקה"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <Button kind="ghost" className="w-full" onClick={toFixed}>
            <Plus size={16} className="ml-1 inline" /> להוסיף כהוצאה קבועה
          </Button>
        </div>
      )}
    </article>
  );
}

export default function InvoicesView({ data }) {
  const [state, setState] = useState({ loading: true, enabled: true, accounts: [], state: {} });
  const [error, setError] = useState('');
  const suppliers = useMemo(() => invoicesBySupplier(data), [data]);

  const reload = useCallback(() => {
    api('/mail/list')
      .then((r) => setState({ loading: false, ...r }))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // בזמן בדיקה – מתעדכנים כל 5 שניות, ובסוף מסנכרנים את החשבוניות החדשות
  const running = state.state?.running;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      reload();
      sync();
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [running, reload]);

  const runNow = async () => {
    setError('');
    try {
      await api('/mail/run');
      setState((s) => ({ ...s, state: { ...s.state, running: true } }));
      setTimeout(reload, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const total = suppliers.reduce((x, s) => x + (s.last.date.startsWith(thisMonth()) ? s.last.amount : 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">חשבוניות מהמייל</h1>
          <p className="text-sm text-muted">
            {state.state?.lastRun ? `בדיקה אחרונה ${ago(state.state.lastRun)}` : 'עוד לא נבדק'}
            {total > 0 && ` · ${money(total)} בחשבוניות של ${monthName(thisMonth())}`}
          </p>
        </div>
        {state.accounts.length > 0 && (
          <button onClick={runNow} disabled={running} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-page disabled:opacity-60">
            <RefreshCw size={16} className={running ? 'animate-spin' : ''} /> {running ? 'בודק חשבוניות…' : 'לבדוק עכשיו'}
          </button>
        )}
      </div>
      {error && <p className="mb-4 rounded-xl bg-minus/10 p-3 text-sm text-minus">{error}</p>}

      {!state.loading && !state.enabled ? (
        <p className="mb-5 rounded-2xl border border-line bg-card p-4 text-sm">חיבור מיילים עוד לא הופעל בשרת. הוא יופעל אוטומטית בעדכון הבא.</p>
      ) : (
        <Mailboxes state={state} reload={reload} />
      )}

      {suppliers.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {suppliers.map((s) => (
            <SupplierCard key={s.supplier} s={s} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">עוד אין חשבוניות. אחרי שמחברים תיבה, הן יופיעו כאן לפי ספק.</p>
      )}
    </div>
  );
}
