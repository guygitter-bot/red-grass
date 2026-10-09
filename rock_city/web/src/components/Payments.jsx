import { useMemo, useState } from 'react';
import { METHODS, PAY_STATE, addMonths, fullName, newId, paymentStatus, payText, showDate, today, whatsapp } from '../lib/schedule';
import { run } from './Panels';
import { Button, Card, Chips, Empty, Field, Input, Select, Sheet } from './ui';

// מי צריך לשלם: באיחור, בשבוע הקרוב, בלי תשלום בכלל, ומי ששילם
export default function Payments({ app }) {
  const now = today();
  const month = now.slice(0, 7);
  const rows = useMemo(
    () =>
      app.students
        .filter((s) => s.active !== false)
        .map((s) => ({ s, st: paymentStatus(s.id, app.payments, now), lessons: app.lessons.filter((l) => l.studentIds.includes(s.id)).length }))
        .sort((a, b) => (a.st.daysLeft ?? -999) - (b.st.daysLeft ?? -999)),
    [app.students, app.payments, app.lessons, now],
  );
  const groups = [
    { key: 'late', title: '🔴 לא שולם בזמן' },
    { key: 'soon', title: '🟠 תשלום בשבוע הקרוב' },
    { key: 'none', title: '⚪ עוד לא נרשם תשלום' },
    { key: 'ok', title: '🟢 שולם' },
  ];
  const thisMonth = app.payments.filter((p) => p.date.startsWith(month));
  const total = thisMonth.reduce((n, p) => n + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">תשלומים</h1>
        <Button className="ms-auto" onClick={() => app.open({ type: 'payment' })}>
          + רישום תשלום
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="לא שולם בזמן" value={rows.filter((r) => r.st.state === 'late').length} className="text-danger" />
        <Tile label="בשבוע הקרוב" value={rows.filter((r) => r.st.state === 'soon').length} className="text-orange" />
        <Tile label="תשלומים החודש" value={thisMonth.length} />
        <Tile label="סכום החודש" value={`₪${total.toLocaleString('he-IL')}`} />
      </div>
      {groups.map((g) => {
        const list = rows.filter((r) => r.st.state === g.key && (g.key !== 'none' || r.lessons > 0));
        if (!list.length) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-2 font-bold">
              {g.title} <span className="font-normal text-muted">({list.length})</span>
            </h2>
            <div className="grid gap-2 lg:grid-cols-2">
              {list.map(({ s, st }) => (
                <PayRow key={s.id} app={app} student={s} st={st} />
              ))}
            </div>
          </section>
        );
      })}
      {rows.length === 0 && (
        <Card>
          <Empty>עוד אין תלמידים</Empty>
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, className = '' }) {
  return (
    <Card className="!p-3 text-center">
      <div className={`text-2xl font-extrabold ${className}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}

function PayRow({ app, student: s, st }) {
  const phone = s.contactPhone || s.phone;
  const remind = whatsapp(
    phone,
    `שלום${s.contactName ? ` ${s.contactName}` : ''}, תזכורת ידידותית מרוק סיטי 🎸 על תשלום עבור השיעורים של ${s.first}${s.fee ? ` (₪${s.fee})` : ''}. תודה!`,
  );
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-3 shadow-sm">
      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => app.open({ type: 'student', id: s.id })}>
        <span className="block truncate font-bold">{fullName(s)}</span>
        <span className={`block text-sm ${PAY_STATE[st.state].text}`}>{payText(st)}</span>
        {st.last && (
          <span className="block text-xs text-muted">
            אחרון: ₪{st.last.amount} ב־{showDate(st.last.date)}
          </span>
        )}
      </button>
      {phone && (st.state === 'late' || st.state === 'soon') && (
        <a href={remind} target="_blank" rel="noreferrer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft" title="תזכורת בוואטסאפ" aria-label="תזכורת בוואטסאפ">
          💬
        </a>
      )}
      <Button kind="secondary" className="shrink-0 !px-3" onClick={() => app.open({ type: 'payment', studentId: s.id })}>
        💰 תשלום
      </Button>
    </div>
  );
}

// רישום / עריכה של תשלום. "עד מתי" – ברירת מחדל: חודש אחרי הסוף של התשלום הקודם
export function PaymentForm({ app, panel, onBack }) {
  const editing = !!panel.payment;
  const [p, setP] = useState(() => {
    if (panel.payment) return { ...panel.payment };
    const studentId = panel.studentId || '';
    return fresh(app, studentId);
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const s = app.studentMap[p.studentId];

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const res = await run(app, '/save', { kind: 'payment', item: p }, editing ? 'התשלום עודכן' : `נרשם תשלום ₪${p.amount}`);
    setBusy(false);
    if (res) (onBack || app.close)();
  }

  async function remove() {
    if (!window.confirm('למחוק את התשלום?')) return;
    if (await run(app, '/remove', { kind: 'payment', id: p.id }, 'התשלום נמחק')) (onBack || app.close)();
  }

  return (
    <Sheet title={editing ? 'עריכת תשלום' : 'רישום תשלום'} onClose={app.close} onBack={onBack}>
      <form onSubmit={save} className="space-y-3">
        <Field label="תלמיד">
          <Select value={p.studentId} onChange={(e) => setP({ ...fresh(app, e.target.value), id: p.id })} required disabled={editing}>
            <option value="">בחירת תלמיד</option>
            {app.students
              .filter((x) => x.active !== false || x.id === p.studentId)
              .sort((a, b) => fullName(a).localeCompare(fullName(b), 'he'))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {fullName(x)}
                </option>
              ))}
          </Select>
        </Field>
        {s && !editing && <p className="text-sm text-muted">{payText(paymentStatus(s.id, app.payments))}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)">
            <Input type="number" min="0" inputMode="numeric" value={p.amount} onChange={(e) => set({ amount: e.target.value })} required />
          </Field>
          <Field label="תאריך התשלום">
            <Input type="date" value={p.date} onChange={(e) => set({ date: e.target.value })} required />
          </Field>
        </div>
        <Field label="משולם עד (מתי התשלום הבא)">
          <Input type="date" value={p.until} onChange={(e) => set({ until: e.target.value })} />
          <div className="mt-2">
            <Chips
              options={[1, 2, 3, 6, 12].map((m) => ({ value: m, label: m === 1 ? 'חודש' : `${m} חודשים` }))}
              value={null}
              onChange={(m) => set({ until: addMonths(start(app, p.studentId, p.date, editing ? p.id : null), m), amount: s?.fee ? s.fee * m : p.amount })}
            />
          </div>
        </Field>
        <Field label="אמצעי תשלום">
          <Chips options={METHODS.map((m) => ({ value: m, label: m }))} value={p.method} onChange={(method) => set({ method })} />
        </Field>
        <Field label="הערה">
          <Input value={p.note} onChange={(e) => set({ note: e.target.value })} placeholder="מספר קבלה, הנחה..." />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1 text-lg" disabled={busy || !p.studentId}>
            שמירה
          </Button>
          {editing ? (
            <Button kind="danger" onClick={remove}>
              מחיקה
            </Button>
          ) : (
            <Button kind="secondary" onClick={onBack || app.close}>
              ביטול
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

// התשלום החדש מתחיל מאיפה שהקודם נגמר (אם עוד לא עבר), אחרת מהיום
function start(app, studentId, date, skipId) {
  const st = paymentStatus(studentId, app.payments.filter((x) => x.id !== skipId), date);
  return st.paidUntil && st.paidUntil > date ? st.paidUntil : date;
}

function fresh(app, studentId) {
  const s = app.studentMap[studentId];
  const date = today();
  return { id: newId('pay'), studentId, amount: s?.fee ?? '', date, until: studentId ? addMonths(start(app, studentId, date), 1) : '', method: 'ביט', note: '' };
}
