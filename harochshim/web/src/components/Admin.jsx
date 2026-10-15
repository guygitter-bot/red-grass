// אפליקציית המאסטר (#/admin): רואה הכול – לידים, ספקים, הצעות, קטגוריות. נכנסים בסיסמה
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileText, LogOut, Plus, RotateCcw, Trash2, UserMinus } from 'lucide-react';
import { api, load, store } from '../lib/api';
import { download, isStale, leadsCsv, money, newId, openFile, readFile } from '../lib/format';
import { Button, Empty, ErrorLine, Field, Price, Sheet, Stripes, TopBar, inputClass } from './ui';
import Leads, { namer } from './Leads';

function Login({ onToken }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api('/login', { password });
      store('hr_admin', token);
      onToken(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <TopBar title="ניהול הרוכשים" />
      <main className="mx-auto max-w-sm px-4 py-10">
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
          <Field label="סיסמת מנהל">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputClass} autoFocus />
          </Field>
          <ErrorLine error={error} />
          <Button type="submit" disabled={busy || !password}>
            {busy ? 'נכנס…' : 'כניסה'}
          </Button>
        </form>
      </main>
    </>
  );
}

const TABS = [
  ['leads', 'לידים'],
  ['suppliers', 'ספקים'],
  ['categories', 'קטגוריות'],
  ['usage', 'עלויות'],
];

export default function Admin() {
  const [token, setToken] = useState(() => load('hr_admin', ''));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('leads');

  const refresh = useCallback(async () => {
    try {
      setData(await api('/admin/state', {}, token));
      setError('');
    } catch (e) {
      if (e.status === 401) {
        store('hr_admin', null);
        setToken('');
      } else setError(e.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [token, refresh]);

  // פעולה בשרת ואז רענון
  const act = useCallback(
    async (path, body) => {
      const res = await api(path, body, token);
      await refresh();
      return res;
    },
    [token, refresh],
  );

  if (!token) return <Login onToken={setToken} />;

  const logout = async () => {
    await api('/logout', {}, token).catch(() => {});
    store('hr_admin', null);
    setToken('');
  };

  return (
    <>
      <TopBar title="ניהול הרוכשים" sub="המאסטר: כל הלקוחות והספקים">
        <a href="#/" className="rounded-xl bg-white/10 px-3 py-1.5 text-sm">
          לאפליקציה
        </a>
        <button onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="יציאה">
          <LogOut size={18} />
        </button>
      </TopBar>
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-card p-1">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 font-bold ${tab === k ? 'bg-navy text-white dark:bg-sky dark:text-navy' : 'text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        <ErrorLine error={error} />
        {!data && !error && <div className="text-muted">טוען…</div>}
        {data && tab === 'leads' && <LeadsTab data={data} act={act} />}
        {data && tab === 'suppliers' && <SuppliersTab data={data} act={act} />}
        {data && tab === 'categories' && <CategoriesTab data={data} act={act} />}
        {data && tab === 'usage' && <UsageTab data={data} />}
      </main>
    </>
  );
}

// ---------- לידים + ייצוא ----------

function LeadsTab({ data, act }) {
  const [supplierId, setSupplierId] = useState('');
  const [month, setMonth] = useState('');
  const names = namer(data);
  const months = [...new Set(data.leads.map((l) => new Date(l.createdAt).toISOString().slice(0, 7)))].sort().reverse();
  const leads = data.leads.filter((l) => (!supplierId || l.supplierId === supplierId) && (!month || new Date(l.createdAt).toISOString().startsWith(month)));
  const won = leads.filter((l) => l.status === 'won');

  const exportCsv = () => {
    download(`harochshim-leads${supplierId ? `-${supplierId}` : ''}${month ? `-${month}` : ''}.csv`, leadsCsv(leads, data));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['לידים', leads.length],
          ['לא טופלו 48 ש׳', leads.filter((l) => isStale(l)).length],
          ['עסקאות', won.length],
          ['סכום עסקאות', money(won.reduce((s, l) => s + (l.amount || 0), 0)) || '₪0'],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-3">
            <div className="text-2xl font-extrabold tabular-nums">{n}</div>
            <div className="text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="ספק">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
            <option value="">כל הספקים</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? '' : ' (הורד)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="חודש">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass}>
            <option value="">כל החודשים</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m.split('-').reverse().join('/')}
              </option>
            ))}
          </select>
        </Field>
        <Button kind="alt" onClick={exportCsv} disabled={!leads.length} className="flex items-center gap-1.5">
          <Download size={18} /> הורדה לאקסל
        </Button>
      </div>
      <Leads leads={leads} names={names} showSupplier onSave={(patch) => act('/admin/lead', patch)} />
    </div>
  );
}

// ---------- ספקים ----------

function SuppliersTab({ data, act }) {
  const [editing, setEditing] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const active = data.suppliers.filter((s) => s.active);
  const removed = data.suppliers.filter((s) => !s.active);
  const cat = (id) => data.categories.find((c) => c.id === id);
  const leadsOf = (id) => data.leads.filter((l) => l.supplierId === id);

  const row = (s) => {
    const leads = leadsOf(s.id);
    const stale = leads.filter((l) => isStale(l)).length;
    return (
      <button key={s.id} onClick={() => setEditing(s.id)} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 text-start hover:border-sky">
        <div className="min-w-0">
          <div className="font-bold">{s.name}</div>
          <div className="truncate text-sm text-muted">
            {s.categoryIds.map((id) => cat(id)?.name).filter(Boolean).join(' · ') || 'בלי קטגוריה'}
            {s.area && ` | ${s.area}`}
          </div>
        </div>
        <div className="shrink-0 text-end text-sm">
          <div className="tabular-nums">
            {data.offers.filter((o) => o.supplierId === s.id).length} הצעות · {leads.length} לידים
          </div>
          {stale > 0 && <div className="font-bold text-coral-ink">{stale} לא טופלו</div>}
          {!s.hasLink && s.active && <div className="text-muted">אין קישור לספק</div>}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setEditing('new')} className="flex items-center justify-center gap-1.5 self-start">
        <Plus size={18} /> ספק חדש
      </Button>
      {!active.length && <Empty>עוד אין ספקים. הוסיפו את הספק הראשון.</Empty>}
      {active.map(row)}
      {removed.length > 0 && (
        <button onClick={() => setShowRemoved(!showRemoved)} className="mt-3 self-start text-sm font-bold text-muted underline">
          {showRemoved ? 'הסתרת' : 'הצגת'} ספקים שהורדו ({removed.length})
        </button>
      )}
      {showRemoved && <div className="flex flex-col gap-2 opacity-75">{removed.map(row)}</div>}
      {editing && <SupplierSheet data={data} act={act} id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onCreated={setEditing} />}
    </div>
  );
}

const EMPTY_SUPPLIER = { name: '', categoryIds: [], area: '', contact: '', phone: '', email: '', website: '', about: '', knowledge: '', notes: '' };

function SupplierSheet({ data, act, id, onClose, onCreated }) {
  const existing = data.suppliers.find((s) => s.id === id);
  const [form, setForm] = useState(() => ({ ...EMPTY_SUPPLIER, ...existing }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [offer, setOffer] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn, okMsg) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const sid = existing?.id || newId('sup');
      await act('/admin/supplier', { ...form, id: sid });
      if (!existing) onCreated(sid);
    }, 'נשמר');

  const makeLink = () =>
    run(async () => {
      const { token } = await act('/admin/supplier-link', { id: existing.id });
      setLink(`${window.location.origin}${window.location.pathname}#/partner/${token}`);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMsg('הקישור הועתק');
    } catch {
      setMsg('סמנו את הקישור והעתיקו');
    }
  };

  const offers = existing ? data.offers.filter((o) => o.supplierId === existing.id) : [];

  return (
    <Sheet title={existing ? existing.name : 'ספק חדש'} onClose={onClose} wide>
      <div className="flex flex-col gap-4 p-4">
        {existing && !existing.active && (
          <div className="rounded-xl bg-sun/40 px-3 py-2 text-sm text-ink">הספק הורד מהרשימה: הלקוחות לא רואים אותו והקישור שלו לא עובד. כל הנתונים שמורים.</div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שם הספק">
            <input value={form.name} onChange={set('name')} maxLength={60} className={inputClass} />
          </Field>
          <Field label="אזור שירות">
            <input value={form.area} onChange={set('area')} maxLength={60} placeholder="כל הארץ / מרכז / צפון…" className={inputClass} />
          </Field>
          <Field label="איש קשר">
            <input value={form.contact} onChange={set('contact')} maxLength={60} className={inputClass} />
          </Field>
          <Field label="טלפון איש הקשר">
            <input value={form.phone} onChange={set('phone')} dir="ltr" className={`${inputClass} text-right`} />
          </Field>
          <Field label="מייל">
            <input value={form.email} onChange={set('email')} dir="ltr" className={`${inputClass} text-right`} />
          </Field>
          <Field label="אתר">
            <input value={form.website} onChange={set('website')} dir="ltr" placeholder="https://" className={`${inputClass} text-right`} />
          </Field>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-muted">קטגוריות</div>
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((c) => {
              const on = form.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setForm({ ...form, categoryIds: on ? form.categoryIds.filter((x) => x !== c.id) : [...form.categoryIds, c.id] })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-sky bg-soft font-bold text-sky-ink' : 'border-line'}`}
                >
                  {c.emoji} {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="על הספק (מוצג ללקוחות)">
          <textarea value={form.about} onChange={set('about')} rows={3} maxLength={1500} className={inputClass} />
        </Field>
        <Field label="בנק המידע לעוזר החכם (לא מוצג ללקוחות)" hint="כל מה שהעוזר צריך לדעת: מוצרים, מחירים, אחריות, זמני אספקה והתקנה, שאלות נפוצות. העוזר עונה רק ממה שכתוב כאן ומההצעות.">
          <textarea value={form.knowledge} onChange={set('knowledge')} rows={6} maxLength={30000} className={inputClass} />
        </Field>
        <Field label="הערות פנימיות (רק לך)" hint="למשל: תנאי ההתחשבנות עם הספק">
          <textarea value={form.notes} onChange={set('notes')} rows={2} maxLength={2000} className={inputClass} />
        </Field>
        <ErrorLine error={error} />
        {msg && <div className="text-sm font-bold text-sky-ink">{msg}</div>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy || !form.name.trim()}>
            {existing ? 'שמירה' : 'הוספת הספק'}
          </Button>
          {existing && existing.active && (
            <Button kind="ghost" onClick={makeLink} disabled={busy}>
              {existing.hasLink ? 'קישור חדש לספק' : 'יצירת קישור לספק'}
            </Button>
          )}
          {existing &&
            (existing.active ? (
              <Button kind="danger" disabled={busy} onClick={() => run(() => act('/admin/supplier-active', { id: existing.id, active: false }), 'הספק הורד מהרשימה')} className="flex items-center gap-1.5">
                <UserMinus size={18} /> הורדה מהרשימה
              </Button>
            ) : (
              <Button kind="alt" disabled={busy} onClick={() => run(() => act('/admin/supplier-active', { id: existing.id, active: true }), 'הספק חזר לרשימה')} className="flex items-center gap-1.5">
                <RotateCcw size={18} /> החזרה לרשימה
              </Button>
            ))}
        </div>
        {link && (
          <div className="flex flex-col gap-2 rounded-xl bg-soft p-3 text-sm">
            <div>
              שלחו לספק את הקישור הזה (בוואטסאפ או במייל). דרכו הוא רואה רק את הלידים שלו.
              {existing.hasLink && ' הקישור הקודם הפסיק לעבוד.'}
            </div>
            <input readOnly value={link} onFocus={(e) => e.target.select()} dir="ltr" className={`${inputClass} text-xs`} />
            <Button kind="alt" onClick={copy} className="flex items-center gap-1.5 self-start">
              <Copy size={16} /> העתקה
            </Button>
          </div>
        )}

        {existing && (
          <section className="flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <Stripes /> הצעות מחיר ({offers.length})
              </h3>
              <Button kind="alt" onClick={() => setOffer('new')} className="flex items-center gap-1 py-1.5 text-sm">
                <Plus size={16} /> הצעה
              </Button>
            </div>
            {!offers.length && <Empty>עוד אין הצעות לספק הזה.</Empty>}
            {offers.map((o) => (
              <button key={o.id} onClick={() => setOffer(o.id)} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-start hover:border-sky">
                <div className="min-w-0">
                  <div className="font-bold">
                    {o.title} {o.hot && <span className="rounded bg-sun px-1 text-xs text-navy">חם</span>}
                  </div>
                  <Price offer={o} />
                </div>
                <div className="shrink-0 text-xs text-muted">
                  {o.file && <FileText size={16} className="inline" />} {!o.active && 'מוסתרת'}
                  {o.validUntil && o.validUntil < new Date().toISOString().slice(0, 10) && 'פג תוקף'}
                </div>
              </button>
            ))}
          </section>
        )}
      </div>
      {offer && <OfferSheet data={data} act={act} supplier={existing} id={offer === 'new' ? null : offer} onClose={() => setOffer(null)} />}
    </Sheet>
  );
}

function OfferSheet({ data, act, supplier, id, onClose }) {
  const existing = data.offers.find((o) => o.id === id);
  const [form, setForm] = useState(() => ({
    title: '',
    details: '',
    price: '',
    regularPrice: '',
    discount: '',
    validUntil: '',
    hot: false,
    active: true,
    categoryId: supplier.categoryIds[0] || '',
    ...existing,
  }));
  const [file, setFile] = useState(undefined); // undefined = בלי שינוי, null = הסרה, אובייקט = חדש
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try {
      setFile(await readFile(f));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await act('/admin/offer', { ...form, id: existing?.id || newId('off'), supplierId: supplier.id, ...(file !== undefined ? { file } : {}) });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await act('/admin/offer-remove', { id: existing.id });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const cats = useMemo(() => data.categories.filter((c) => supplier.categoryIds.includes(c.id) || c.id === form.categoryId), [data.categories, supplier, form.categoryId]);
  const currentFile = file === undefined ? existing?.file : file;

  return (
    <Sheet title={existing ? 'עריכת הצעה' : `הצעה חדשה – ${supplier.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <Field label="כותרת">
          <input value={form.title} onChange={set('title')} maxLength={120} placeholder="למשל: מקלחון פינתי כולל התקנה" className={inputClass} />
        </Field>
        <Field label="קטגוריה">
          <select value={form.categoryId} onChange={set('categoryId')} className={inputClass}>
            {(cats.length ? cats : data.categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר לחברים (₪)">
            <input value={form.price || ''} onChange={set('price')} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="מחיר רגיל (₪)">
            <input value={form.regularPrice || ''} onChange={set('regularPrice')} inputMode="numeric" className={inputClass} />
          </Field>
        </div>
        <Field label="הנחה במילים (לא חובה)" hint="למשל: 10% על כל הקטלוג">
          <input value={form.discount} onChange={set('discount')} maxLength={40} className={inputClass} />
        </Field>
        <Field label="פרטים">
          <textarea value={form.details} onChange={set('details')} rows={4} maxLength={3000} className={inputClass} />
        </Field>
        <Field label="בתוקף עד (לא חובה)">
          <input type="date" value={form.validUntil} onChange={set('validUntil')} className={inputClass} />
        </Field>
        <div>
          <div className="mb-1 text-sm font-medium text-muted">קובץ הצעת המחיר (PDF או תמונה)</div>
          {currentFile ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileText size={16} />
              {existing?.file && file === undefined ? (
                <button onClick={async () => openFile((await api('/admin/file', { id: existing.id }, load('hr_admin', ''))).file)} className="text-sky-ink underline">
                  {currentFile.name}
                </button>
              ) : (
                <span>{currentFile.name}</span>
              )}
              <button onClick={() => setFile(null)} className="text-coral-ink underline">
                הסרה
              </button>
            </div>
          ) : (
            <input type="file" accept="application/pdf,image/*" onChange={pick} className="text-sm" />
          )}
          <div className="mt-1 text-xs text-muted">העוזר החכם קורא את הקובץ ועונה ממנו ללקוחות.</div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.hot} onChange={(e) => setForm({ ...form, hot: e.target.checked })} className="size-4 accent-coral" /> הטבה חמה (מוצגת במסך הבית)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="size-4 accent-coral" /> מוצגת ללקוחות
        </label>
        <ErrorLine error={error} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy || !form.title.trim()}>
            {busy ? 'שומר…' : 'שמירה'}
          </Button>
          {existing &&
            (confirmDelete ? (
              <Button kind="danger" onClick={remove} disabled={busy}>
                בטוח? מחיקת ההצעה
              </Button>
            ) : (
              <Button kind="ghost" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5">
                <Trash2 size={16} /> מחיקה
              </Button>
            ))}
        </div>
      </div>
    </Sheet>
  );
}

// ---------- קטגוריות ----------

function CategoriesTab({ data, act }) {
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const run = async (body) => {
    setError('');
    try {
      await act('/admin/category', body);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run({ id: newId('cat'), name, emoji, order: data.categories.length, active: true }).then(() => {
            setName('');
            setEmoji('');
          });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Field label="סמל">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className={`${inputClass} w-16 text-center`} />
        </Field>
        <Field label="קטגוריה חדשה">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputClass} />
        </Field>
        <Button type="submit" disabled={!name.trim()}>
          הוספה
        </Button>
      </form>
      <ErrorLine error={error} />
      {data.categories.map((c, i) => (
        <CategoryRow key={c.id} c={c} first={i === 0} last={i === data.categories.length - 1} prev={data.categories[i - 1]} next={data.categories[i + 1]} run={run} count={data.offers.filter((o) => o.categoryId === c.id).length} />
      ))}
    </div>
  );
}

function CategoryRow({ c, first, last, prev, next, run, count }) {
  const [name, setName] = useState(c.name);
  const [emoji, setEmoji] = useState(c.emoji);
  const changed = name !== c.name || emoji !== c.emoji;
  // החלפת מקום עם השכן
  const swap = async (other) => {
    await run({ ...c, order: other.order });
    await run({ ...other, order: c.order });
  };
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-2 ${c.active ? '' : 'opacity-60'}`}>
      <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className={`${inputClass} w-14 text-center`} aria-label="סמל" />
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={`${inputClass} min-w-0 flex-1`} aria-label="שם" />
      <span className="text-sm text-muted tabular-nums">{count} הצעות</span>
      {changed && (
        <Button kind="alt" onClick={() => run({ ...c, name, emoji })} className="py-1.5 text-sm">
          שמירה
        </Button>
      )}
      <button disabled={first} onClick={() => swap(prev)} className="rounded-lg px-2 py-1 disabled:opacity-30" aria-label="למעלה">
        ▲
      </button>
      <button disabled={last} onClick={() => swap(next)} className="rounded-lg px-2 py-1 disabled:opacity-30" aria-label="למטה">
        ▼
      </button>
      <button onClick={() => run({ ...c, active: !c.active })} className="rounded-lg px-2 py-1 text-sm text-muted underline">
        {c.active ? 'הסתרה' : 'הצגה'}
      </button>
    </div>
  );
}

// ---------- עלויות העוזר החכם ----------

// מחירי claude-opus-5-5 לכל מיליון טוקנים (קלט, פלט, קריאה מהמטמון, כתיבה למטמון)
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const USD_TO_ILS = 3.7;

function UsageTab({ data }) {
  const months = Object.entries(data.usage || {}).sort((a, b) => b[0].localeCompare(a[0]));
  if (!months.length) return <Empty>עוד לא היו שיחות עם העוזר החכם.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {months.map(([m, u]) => {
        const usd = (u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1e6;
        return (
          <div key={m} className="flex items-center justify-between rounded-2xl border border-line bg-card p-3">
            <div>
              <div className="font-bold">{m.split('-').reverse().join('/')}</div>
              <div className="text-sm text-muted tabular-nums">{u.calls} תשובות של העוזר</div>
            </div>
            <div className="text-end tabular-nums">
              <div className="font-bold">₪{(usd * USD_TO_ILS).toFixed(2)}</div>
              <div className="text-xs text-muted">${usd.toFixed(2)} (הערכה)</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
