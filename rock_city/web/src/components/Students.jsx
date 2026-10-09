import { useMemo, useState } from 'react';
import { PAY_STATE, daysBetween, fullName, newId, paymentStatus, payText, showDate, today } from '../lib/schedule';
import { LessonCard } from './Calendar';
import { run } from './Panels';
import { Button, Card, ContactButtons, Empty, Field, Input, Sheet, Textarea } from './ui';

// רשימת התלמידים עם חיפוש
export default function Students({ app }) {
  const [q, setQ] = useState('');
  const [showOld, setShowOld] = useState(false);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return app.students
      .filter((s) => showOld || s.active !== false)
      .filter((s) => words.every((w) => `${fullName(s)} ${s.phone} ${s.contactName}`.toLowerCase().includes(w)))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'he'));
  }, [app.students, q, showOld]);
  const old = app.students.filter((s) => s.active === false).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">תלמידים</h1>
        <span className="text-muted">({list.length})</span>
        {app.canEdit && (
          <Button className="ms-auto" onClick={() => app.open({ type: 'studentForm' })}>
            + תלמיד
          </Button>
        )}
      </div>
      <Input placeholder="🔍 חיפוש לפי שם או טלפון" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? (
        <Card>
          <Empty>{app.students.length ? 'לא נמצאו תלמידים' : 'עוד אין תלמידים'}</Empty>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <StudentRow key={s.id} app={app} student={s} />
          ))}
        </div>
      )}
      {old > 0 && (
        <button type="button" className="text-sm text-muted underline" onClick={() => setShowOld(!showOld)}>
          {showOld ? 'להסתיר תלמידים לא פעילים' : `להציג גם ${old} תלמידים לא פעילים`}
        </button>
      )}
    </div>
  );
}

function StudentRow({ app, student: s }) {
  const lessons = app.lessons.filter((l) => l.studentIds.includes(s.id));
  const subjects = [...new Set(lessons.map((l) => l.subject).filter(Boolean))];
  const teachers = [...new Set(lessons.map((l) => app.teacherMap[l.teacherId]?.first).filter(Boolean))];
  const pay = app.isManager ? PAY_STATE[paymentStatus(s.id, app.payments).state] : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => app.open({ type: 'student', id: s.id })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') app.open({ type: 'student', id: s.id });
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm transition hover:bg-soft ${s.active === false ? 'opacity-60' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-bold">
          {pay && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pay.dot}`} title={pay.label} />}
          <span className="truncate">{fullName(s)}</span>
        </div>
        <div className="truncate text-sm text-muted">{[subjects.join(', '), teachers.join(', ')].filter(Boolean).join(' · ') || 'אין שיעורים'}</div>
      </div>
      <ContactButtons phone={s.phone || s.contactPhone} />
    </div>
  );
}

// כרטיס תלמיד: פרטים, שיעורים ותשלומים
export function StudentView({ app, panel, onBack }) {
  const s = app.studentMap[panel.id];
  if (!s) {
    return (
      <Sheet title="תלמיד" onClose={app.close} onBack={onBack}>
        <p className="py-6 text-center text-muted">התלמיד נמחק</p>
      </Sheet>
    );
  }
  const lessons = app.lessons.filter((l) => l.studentIds.includes(s.id)).sort((a, b) => (a.kind === 'once' ? 7 : a.day) - (b.kind === 'once' ? 7 : b.day) || a.start.localeCompare(b.start));
  const pay = app.isManager ? paymentStatus(s.id, app.payments) : null;
  const age = s.birth ? Math.floor(daysBetween(s.birth, today()) / 365.25) : null;

  async function remove() {
    if (!window.confirm(`למחוק את ${fullName(s)} וכל התשלומים שלו?`)) return;
    if (await run(app, '/remove', { kind: 'student', id: s.id }, 'התלמיד נמחק')) app.close();
  }

  const rows = [
    ['📞 טלפון', s.phone, s.phone],
    ['🏠 כתובת', s.address],
    ['👤 איש קשר', s.contactName, s.contactPhone],
    ['🎂 תאריך לידה', s.birth && `${showDate(s.birth)} (גיל ${age})`],
    app.isManager && ['💳 מחיר לחודש', s.fee != null && `₪${s.fee}`],
  ].filter((r) => r && r[1]);

  return (
    <Sheet title={fullName(s)} onClose={app.close} onBack={onBack}>
      <div className="space-y-4">
        {s.active === false && <p className="rounded-xl bg-soft p-2 text-center text-sm">תלמיד לא פעיל</p>}
        <Card className="space-y-2 !p-3">
          {rows.length === 0 && <p className="text-muted">אין עדיין פרטים</p>}
          {rows.map(([label, value, phone]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-muted">{label}</span>
              <span className="min-w-0 flex-1">
                {value}
                {phone && phone !== value && <span className="block text-sm text-muted">{phone}</span>}
              </span>
              {phone && <ContactButtons phone={phone} />}
            </div>
          ))}
        </Card>
        {s.notes && <p className="whitespace-pre-line rounded-xl bg-soft p-3 text-sm">{s.notes}</p>}

        <section>
          <h3 className="mb-2 font-bold">שיעורים</h3>
          {lessons.length === 0 && <p className="text-sm text-muted">אין שיעורים</p>}
          <div className="space-y-2">
            {lessons.map((l) => (
              <LessonCard key={l.id} app={app} lesson={l} showDay onClick={() => app.open({ type: 'lesson', id: l.id })} />
            ))}
          </div>
          {app.canEdit && (
            <Button kind="secondary" className="mt-2" onClick={() => app.open({ type: 'lessonForm', preset: { studentIds: [s.id] } })}>
              + שיעור ל{s.first}
            </Button>
          )}
        </section>

        {pay && (
          <section>
            <h3 className="mb-2 font-bold">תשלומים</h3>
            <p className={`rounded-xl bg-card p-3 font-medium ${PAY_STATE[pay.state].text}`}>{payText(pay)}</p>
            <div className="mt-2 space-y-1">
              {pay.payments.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => app.open({ type: 'payment', payment: p })}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start text-sm hover:bg-soft"
                >
                  <span className="font-bold">₪{p.amount}</span>
                  <span className="text-muted">{showDate(p.date)}</span>
                  <span className="text-muted">{p.method}</span>
                  {p.until && <span className="ms-auto text-xs text-muted">עד {showDate(p.until)}</span>}
                </button>
              ))}
            </div>
            <Button className="mt-2" onClick={() => app.open({ type: 'payment', studentId: s.id })}>
              💰 רישום תשלום
            </Button>
          </section>
        )}

        {app.canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button kind="secondary" onClick={() => app.open({ type: 'studentForm', student: s })}>
              ✏️ עריכת פרטים
            </Button>
            {app.isManager && (
              <Button kind="danger" onClick={remove}>
                🗑️ מחיקה
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function StudentForm({ app, panel, onBack }) {
  const editing = !!panel.student;
  const [s, setS] = useState(() =>
    panel.student
      ? { ...panel.student, fee: panel.student.fee ?? '' }
      : { id: newId('student'), first: '', last: '', phone: '', address: '', contactName: '', contactPhone: '', birth: '', fee: '', notes: '', active: true },
  );
  const [busy, setBusy] = useState(false);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const res = await run(app, '/save', { kind: 'student', item: s }, editing ? 'הפרטים נשמרו' : 'התלמיד נוסף');
    setBusy(false);
    if (!res) return;
    panel.onSaved?.(s.id);
    if (onBack) onBack();
    else app.close();
  }

  return (
    <Sheet title={editing ? `עריכה – ${fullName(panel.student)}` : 'תלמיד חדש'} onClose={app.close} onBack={onBack}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם פרטי">
            <Input value={s.first} onChange={(e) => set({ first: e.target.value })} required autoFocus />
          </Field>
          <Field label="שם משפחה">
            <Input value={s.last} onChange={(e) => set({ last: e.target.value })} />
          </Field>
        </div>
        <Field label="טלפון">
          <Input type="tel" inputMode="tel" value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="כתובת">
          <Input value={s.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="איש קשר (הורה)">
            <Input value={s.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="טלפון איש קשר">
            <Input type="tel" inputMode="tel" value={s.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך לידה">
            <Input type="date" value={s.birth} onChange={(e) => set({ birth: e.target.value })} />
          </Field>
          {app.isManager && (
            <Field label="מחיר לחודש (₪)">
              <Input type="number" min="0" inputMode="numeric" value={s.fee} onChange={(e) => set({ fee: e.target.value })} />
            </Field>
          )}
        </div>
        <Field label="הערות">
          <Textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="רמה, ספר לימוד, מטרות..." />
        </Field>
        {editing && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent)]" checked={s.active !== false} onChange={(e) => set({ active: e.target.checked })} />
            תלמיד פעיל
          </label>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1 text-lg" disabled={busy}>
            שמירה
          </Button>
          <Button kind="secondary" onClick={onBack || app.close}>
            ביטול
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
