import { useEffect, useMemo, useState } from 'react';
import {
  DAYS,
  PAY_STATE,
  SHORT_DAYS,
  STATUS,
  conflicts,
  dayOf,
  describeLesson,
  endTime,
  fullName,
  newId,
  occursOn,
  paymentStatus,
  payText,
  showDate,
  statusOn,
  today,
  whenText,
} from '../lib/schedule';
import { run } from './Panels';
import { Avatar, Button, Chips, ContactButtons, Field, Input, LinkRow, Select, Sheet, Textarea } from './ui';

// האם שינוי בשיעור הזה יישלח כבקשה (מורה עם עריכה, בשיעור של מורה אחר)
const asRequest = (app, teacherId) => !app.isManager && app.canEdit && teacherId && teacherId !== app.me.id;

// פרטי שיעור: מורה, תלמידים (עם מצב תשלום), זמן, חדר, ומה קרה בתאריך שנבחר
export function LessonView({ app, panel, onBack }) {
  const l = app.lessons.find((x) => x.id === panel.id);
  const [note, setNote] = useState(() => (l && panel.date ? l.dates?.[panel.date]?.note || '' : ''));
  if (!l) {
    return (
      <Sheet title="שיעור" onClose={app.close} onBack={onBack}>
        <p className="py-6 text-center text-muted">השיעור נמחק</p>
      </Sheet>
    );
  }
  const t = app.teacherMap[l.teacherId];
  const date = panel.date && occursOn(l, panel.date) ? panel.date : '';
  const status = date ? statusOn(l, date) : '';
  const request = asRequest(app, l.teacherId);
  const pending = app.requests.filter((r) => r.lessonId === l.id && r.status === 'pending');

  const setStatus = (s) => run(app, '/occurrence', { lessonId: l.id, date, status: s, note }, s === 'cancelled' ? 'השיעור בוטל בתאריך הזה' : 'נשמר');

  async function remove() {
    if (!window.confirm(request ? `לשלוח ל${t?.first} בקשה למחוק את השיעור?` : 'למחוק את השיעור (כל השבועות)?')) return;
    const res = await run(app, '/remove', { kind: 'lesson', id: l.id }, 'השיעור נמחק');
    if (res && !res.request) app.close();
  }

  // העברה של השיעור רק בתאריך הזה: מבטלים אותו כאן ופותחים שיעור חד-פעמי חדש
  const moveOnce = () =>
    app.open({ type: 'lessonForm', preset: { ...l, id: undefined, dates: undefined, kind: 'once', date, cancelDate: date, cancelLessonId: l.id } });

  return (
    <Sheet title={l.subject || 'שיעור'} onClose={app.close} onBack={onBack}>
      <div className="space-y-4">
        <div className="rounded-2xl p-3" style={{ background: `color-mix(in srgb, ${t?.color || '#f5b800'} 20%, var(--color-card))` }}>
          <div className="text-lg font-bold">{whenText(l)}</div>
          {date && l.kind === 'weekly' && <div className="text-sm text-muted">השיעור של יום {DAYS[dayOf(date)]} {showDate(date)}</div>}
          <div className="mt-1 text-sm">
            🚪 {app.roomMap[l.roomId]?.name || 'בלי חדר'} · ⏱️ {l.minutes} דקות
            {l.kind === 'weekly' && (l.from || l.until) && (
              <span className="text-muted">
                {' '}
                · {l.from && `מ־${showDate(l.from)}`} {l.until && `עד ${showDate(l.until)}`}
              </span>
            )}
          </div>
        </div>

        <section>
          <h3 className="mb-1 text-sm font-medium text-muted">מורה</h3>
          <LinkRow onClick={() => app.open({ type: 'teacher', id: l.teacherId })}>
            <Avatar person={t} size={40} />
            <span className="font-bold">{fullName(t)}</span>
          </LinkRow>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-medium text-muted">{l.studentIds.length > 1 ? 'תלמידים' : 'תלמיד'}</h3>
          {l.studentIds.map((id) => {
            const s = app.studentMap[id];
            const pay = app.isManager ? paymentStatus(id, app.payments) : null;
            return (
              <div key={id} className="flex items-center gap-1">
                <LinkRow onClick={() => app.open({ type: 'student', id })} className="min-w-0 flex-1">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{fullName(s)}</span>
                    {pay && (
                      <span className={`block text-sm ${PAY_STATE[pay.state].text}`}>
                        {pay.last ? `שילם ₪${pay.last.amount} · ` : ''}
                        {payText(pay)}
                      </span>
                    )}
                  </span>
                </LinkRow>
                <ContactButtons phone={s?.phone || s?.contactPhone} />
              </div>
            );
          })}
        </section>

        {l.notes && <p className="whitespace-pre-line rounded-xl bg-soft p-3 text-sm">{l.notes}</p>}

        {date && (
          <section className="rounded-2xl border border-line bg-card p-3">
            <h3 className="mb-2 font-bold">מה קרה ב־{showDate(date)}?</h3>
            {app.canEdit ? (
              <>
                <Chips
                  options={[{ value: '', label: 'רגיל' }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: `${s.icon} ${s.label}` }))]}
                  value={status}
                  onChange={setStatus}
                />
                <div className="mt-2 flex gap-2">
                  <Input placeholder="הערה לשיעור הזה (לא חובה)" value={note} onChange={(e) => setNote(e.target.value)} />
                  {note !== (l.dates?.[date]?.note || '') && (
                    <Button kind="secondary" onClick={() => setStatus(status)}>
                      שמירה
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p>{status ? `${STATUS[status].icon} ${STATUS[status].label}` : 'רגיל'}{l.dates?.[date]?.note ? ` – ${l.dates[date].note}` : ''}</p>
            )}
          </section>
        )}

        {pending.length > 0 && (
          <div className="rounded-xl border border-orange/40 bg-orange/10 p-3 text-sm">
            ⏳ יש {pending.length === 1 ? 'בקשה ממתינה' : `${pending.length} בקשות ממתינות`} לשינוי בשיעור הזה
            <button type="button" className="ms-2 underline" onClick={() => {
              app.close();
              app.setTab('inbox');
            }}>
              לצפייה
            </button>
          </div>
        )}

        {request && <p className="text-sm text-muted">זה שיעור של {t?.first}. שינויים יישלחו אליו/אליה כבקשה לאישור.</p>}

        {app.canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => app.open({ type: 'lessonForm', lesson: l })}>✏️ עריכה</Button>
            {date && l.kind === 'weekly' && (
              <Button kind="secondary" onClick={moveOnce}>
                🔀 להזיז רק את השיעור הזה
              </Button>
            )}
            <Button kind="danger" onClick={remove}>
              🗑️ מחיקה
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const DURATIONS = [30, 45, 60, 90];

// הוספה / עריכה של שיעור, עם בדיקת התנגשויות (חדר, מורה, תלמיד)
export function LessonForm({ app, panel, onBack }) {
  const preset = panel.preset || {};
  const [l, setL] = useState(() => {
    if (panel.lesson) return { ...panel.lesson };
    const teacherId = preset.teacherId || (app.me.role === 'teacher' ? app.me.id : app.teachers[0]?.id || '');
    const date = preset.date || today();
    return {
      id: newId('lesson'),
      teacherId,
      studentIds: preset.studentIds || [],
      subject: preset.subject || app.teacherMap[teacherId]?.subjects?.[0] || app.settings.subjects[0] || '',
      roomId: preset.roomId || app.settings.rooms[0]?.id || '',
      kind: preset.kind || 'weekly',
      day: preset.day ?? dayOf(date),
      date,
      start: preset.start || '16:00',
      minutes: preset.minutes || 45,
      from: preset.from ?? (date < today() ? date : today()),
      until: preset.until || '',
      notes: preset.notes || '',
    };
  });
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setL((x) => ({ ...x, ...patch }));
  const editing = !!panel.lesson;

  const found = useMemo(
    () => (l.start ? conflicts(l, app.lessons, { students: app.students, teachers: app.teachers, rooms: app.settings.rooms }) : []),
    [l, app.lessons, app.students, app.teachers, app.settings.rooms],
  );
  // אזהרה באמצע המסך: כשמופיעה התנגשות חדשה, וגם לפני שמירה עם התנגשות
  const [warn, setWarn] = useState(null); // null | 'new' | 'save'
  const [seen, setSeen] = useState('');
  const conflictKey = found.map((c) => c.lesson.id).sort().join(',');
  useEffect(() => {
    if (!conflictKey) setSeen('');
    else if (conflictKey !== seen) setWarn('new');
  }, [conflictKey, seen]);
  const closeWarn = () => {
    setSeen(conflictKey);
    setWarn(null);
  };

  const owner = editing && panel.lesson.teacherId !== app.me.id ? panel.lesson.teacherId : l.teacherId;
  const request = asRequest(app, owner);
  // מורה עם עריכה רואה קודם את עצמו
  const teachers = app.teachers;
  const students = app.students.filter((s) => s.active !== false || l.studentIds.includes(s.id));

  async function save(force = false) {
    if (!l.studentIds.length) return app.toast('⚠️ צריך לבחור תלמיד');
    if (found.length && !force) return setWarn('save');
    setWarn(null);
    setBusy(true);
    const item = l.kind === 'once' ? { ...l, day: dayOf(l.date) } : l;
    const res = await run(app, '/save', { kind: 'lesson', item }, editing ? 'השיעור עודכן' : 'השיעור נוסף');
    if (res && preset.cancelDate) await run(app, '/occurrence', { lessonId: preset.cancelLessonId, date: preset.cancelDate, status: 'cancelled', note: `הועבר ל־${showDate(l.date)} ${l.start}` });
    setBusy(false);
    if (res) app.close();
  }

  return (
    <Sheet title={editing ? 'עריכת שיעור' : preset.cancelDate ? `הזזת השיעור של ${showDate(preset.cancelDate)}` : 'שיעור חדש'} onClose={app.close} onBack={onBack} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מורה">
            <Select
              value={l.teacherId}
              onChange={(e) => {
                const t = app.teacherMap[e.target.value];
                set({ teacherId: e.target.value, subject: t?.subjects?.includes(l.subject) ? l.subject : t?.subjects?.[0] || l.subject });
              }}
            >
              {!l.teacherId && <option value="">בחירת מורה</option>}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {fullName(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={l.studentIds.length > 1 ? 'תלמידים (שיעור קבוצתי / להקה)' : 'תלמיד'}>
            <div className="flex gap-2">
              <Select
                value={pick}
                onChange={(e) => {
                  if (e.target.value) set({ studentIds: [...l.studentIds, e.target.value] });
                  setPick('');
                }}
              >
                <option value="">{l.studentIds.length ? '+ עוד תלמיד' : 'בחירת תלמיד'}</option>
                {students
                  .filter((s) => !l.studentIds.includes(s.id))
                  .sort((a, b) => fullName(a).localeCompare(fullName(b), 'he'))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {fullName(s)}
                    </option>
                  ))}
              </Select>
              <Button
                kind="secondary"
                className="shrink-0 !px-3"
                title="תלמיד חדש"
                onClick={() => app.open({ type: 'studentForm', onSaved: (id) => setL((x) => ({ ...x, studentIds: [...x.studentIds, id] })) })}
              >
                + חדש
              </Button>
            </div>
            {l.studentIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.studentIds.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-soft px-3 py-1 text-sm">
                    {fullName(app.studentMap[id])}
                    <button type="button" className="text-muted" onClick={() => set({ studentIds: l.studentIds.filter((x) => x !== id) })} aria-label="הסרה">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>

        <Field label="נושא">
          <Chips options={[...new Set([...app.settings.subjects, l.subject].filter(Boolean))].map((s) => ({ value: s, label: s }))} value={l.subject} onChange={(subject) => set({ subject })} />
        </Field>

        <Field label="מתי">
          <Chips
            options={[
              { value: 'weekly', label: 'כל שבוע' },
              { value: 'once', label: 'פעם אחת' },
            ]}
            value={l.kind}
            onChange={(kind) => set({ kind })}
          />
        </Field>

        {l.kind === 'weekly' ? (
          <>
            <Chips options={SHORT_DAYS.map((d, i) => ({ value: i, label: `יום ${d}` }))} value={l.day} onChange={(day) => set({ day })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="החל מתאריך">
                <Input type="date" value={l.from} onChange={(e) => set({ from: e.target.value })} />
              </Field>
              <Field label="עד תאריך (לא חובה)">
                <Input type="date" value={l.until} min={l.from || undefined} onChange={(e) => set({ until: e.target.value })} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="תאריך">
            <Input type="date" value={l.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="שעת התחלה">
            <Input type="time" step="300" value={l.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label={`משך (נגמר ב־${l.start ? endTime(l) : '?'})`}>
            <Input type="number" min="10" max="300" step="5" value={l.minutes} onChange={(e) => set({ minutes: Number(e.target.value) || 45 })} />
          </Field>
        </div>
        <Chips options={DURATIONS.map((m) => ({ value: m, label: `${m} דק׳` }))} value={l.minutes} onChange={(minutes) => set({ minutes })} />

        <Field label="חדר">
          <Chips options={app.settings.rooms.map((r) => ({ value: r.id, label: r.name }))} value={l.roomId} onChange={(roomId) => set({ roomId })} />
        </Field>

        <Field label="הערות">
          <Textarea value={l.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="למשל: להביא תווים, ספר לימוד..." />
        </Field>

        {found.length > 0 && (
          <div className="rounded-xl border border-orange/50 bg-orange/10 p-3 text-sm">
            <p className="mb-1 font-bold">⚠️ התנגשות עם שיעורים אחרים</p>
            <ConflictList app={app} lesson={l} found={found} />
          </div>
        )}

        {warn && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={closeWarn}>
            <div className="sheet-in w-full max-w-sm rounded-3xl border-2 border-orange bg-card p-5 text-center shadow-2xl" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="text-5xl">⚠️</div>
              <h3 className="mt-2 text-xl font-bold">{found.length === 1 ? 'יש התנגשות' : `יש ${found.length} התנגשויות`}</h3>
              <div className="mt-3 rounded-xl bg-orange/10 p-3 text-start text-sm">
                <ConflictList app={app} lesson={l} found={found} />
              </div>
              {warn === 'save' ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Button kind="secondary" onClick={closeWarn}>
                    חזרה לתיקון
                  </Button>
                  <Button onClick={() => save(true)} disabled={busy}>
                    {request ? 'לשלוח בקשה בכל זאת' : 'לשמור בכל זאת'}
                  </Button>
                </div>
              ) : (
                <Button className="mt-4 w-full" onClick={closeWarn}>
                  הבנתי
                </Button>
              )}
            </div>
          </div>
        )}

        {request && (
          <p className="rounded-xl bg-soft p-3 text-sm">
            📨 זה שיעור של {app.teacherMap[owner]?.first}. השינוי יישלח אליו/אליה כבקשה, ויתעדכן במערכת רק אחרי אישור.
          </p>
        )}

        <div className="flex gap-2">
          <Button className="flex-1 text-lg" onClick={() => save()} disabled={busy}>
            {request ? 'שליחת בקשה' : 'שמירה'}
          </Button>
          <Button kind="secondary" onClick={onBack || app.close}>
            ביטול
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// רשימת ההתנגשויות: למה (חדר / מורה / תלמיד) ועם איזה שיעור
function ConflictList({ app, lesson, found }) {
  return (
    <ul className="space-y-1">
      {found.slice(0, 5).map((c) => (
        <li key={c.lesson.id}>
          {c.why.join(', ')} – {describeLesson(c.lesson, app.students)}
          {lesson.kind === 'weekly' && c.lesson.kind === 'once' && ` (ב־${showDate(c.date)})`}
        </li>
      ))}
    </ul>
  );
}
