import { useState } from 'react';
import { COLORS, LEVELS, LEVEL_HELP, fullName, newId, whatsapp } from '../lib/schedule';
import { resizePhoto } from '../lib/photo';
import { LessonCard } from './Calendar';
import { run } from './Panels';
import { Avatar, Button, Card, Chips, ContactButtons, Empty, Field, Input, Sheet, Textarea } from './ui';

const weekly = (app, id) => app.lessons.filter((l) => l.teacherId === id && l.kind === 'weekly');
const hours = (lessons) => Math.round((lessons.reduce((n, l) => n + (l.minutes || 45), 0) / 60) * 10) / 10;

export default function Teachers({ app }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">מורים</h1>
        <span className="text-muted">({app.teachers.length})</span>
        {app.isManager && (
          <Button className="ms-auto" onClick={() => app.open({ type: 'teacherForm' })}>
            + מורה
          </Button>
        )}
      </div>
      {app.teachers.length === 0 ? (
        <Card>
          <Empty>עוד אין מורים. מתחילים בהוספת מורה, ואז שולחים לו/לה קישור כניסה.</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {app.teachers.map((t) => {
            const ls = weekly(app, t.id);
            const students = new Set(ls.flatMap((l) => l.studentIds)).size;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => app.open({ type: 'teacher', id: t.id })}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-start shadow-sm transition hover:bg-soft"
              >
                <Avatar person={t} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{fullName(t)}</span>
                  <span className="block truncate text-sm text-muted">{t.subjects.join(', ') || '—'}</span>
                  <span className="block text-xs text-muted">
                    {ls.length} שיעורים בשבוע · {hours(ls)} שעות · {students} תלמידים
                  </span>
                </span>
                {app.isAdmin && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${t.hasLink ? 'bg-soft' : 'bg-line text-muted'}`}>
                    {t.hasLink ? LEVELS[t.level] : 'בלי כניסה'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// כרטיס מורה: תמונה, טלפון, מה מלמד, השיעורים שלו. למנהל – הרשאות וקישור כניסה
export function TeacherView({ app, panel, onBack }) {
  const t = app.teacherMap[panel.id];
  const [link, setLink] = useState('');
  const [level, setLevel] = useState(t?.level || 'edit');
  if (!t) {
    return (
      <Sheet title="מורה" onClose={app.close} onBack={onBack}>
        <p className="py-6 text-center text-muted">המורה נמחק</p>
      </Sheet>
    );
  }
  const ls = app.lessons
    .filter((l) => l.teacherId === t.id)
    .sort((a, b) => (a.kind === 'once' ? 7 : a.day) - (b.kind === 'once' ? 7 : b.day) || a.start.localeCompare(b.start));
  const self = app.me.id === t.id;

  // קישור אישי חדש (הקודם מפסיק לעבוד) – עם רמת ההרשאה שנבחרה
  async function makeLink() {
    if (t.hasLink && !window.confirm(`הקישור הקודם של ${t.first} יפסיק לעבוד. ליצור קישור חדש?`)) return;
    const res = await run(app, '/invite', { teacherId: t.id, level }, 'נוצר קישור חדש');
    if (res?.key) setLink(`${window.location.origin}${window.location.pathname}#k=${res.key}`);
  }

  async function changeLevel(next) {
    setLevel(next);
    if (t.hasLink) await run(app, '/save', { kind: 'teacher', item: { ...t, photo: undefined, level: next } }, `ההרשאה עודכנה: ${LEVELS[next]}`);
  }

  async function revoke() {
    if (!window.confirm(`לבטל את הכניסה של ${t.first}? הקישור שלו/שלה יפסיק לעבוד.`)) return;
    await run(app, '/revoke', { teacherId: t.id }, 'הגישה בוטלה');
    setLink('');
  }

  async function remove() {
    if (!window.confirm(`למחוק את ${fullName(t)}?`)) return;
    if (await run(app, '/remove', { kind: 'teacher', id: t.id }, 'המורה נמחק')) app.close();
  }

  const message = `היי ${t.first}! זה הקישור שלך למערכת השעות של רוק סיטי 🎸\n${link}\n(הקישור אישי – לא להעביר הלאה)`;

  return (
    <Sheet title={fullName(t)} onClose={app.close} onBack={onBack}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar person={t} size={96} />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold">{fullName(t)}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {t.subjects.map((s) => (
                <span key={s} className="rounded-full bg-soft px-2.5 py-0.5 text-sm">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Card className="space-y-2 !p-3">
          {t.phone && (
            <div className="flex items-center gap-2">
              <span className="w-20 text-sm text-muted">📞 טלפון</span>
              <span className="flex-1" dir="ltr">
                {t.phone}
              </span>
              <ContactButtons phone={t.phone} />
            </div>
          )}
          {t.email && (
            <div className="flex items-center gap-2">
              <span className="w-20 text-sm text-muted">✉️ מייל</span>
              <a className="flex-1 truncate underline" href={`mailto:${t.email}`} dir="ltr">
                {t.email}
              </a>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-20 text-sm text-muted">⏱️ בשבוע</span>
            <span>
              {weekly(app, t.id).length} שיעורים · {hours(weekly(app, t.id))} שעות
            </span>
          </div>
        </Card>
        {t.notes && <p className="whitespace-pre-line rounded-xl bg-soft p-3 text-sm">{t.notes}</p>}

        <section>
          <h3 className="mb-2 font-bold">שיעורים</h3>
          {ls.length === 0 && <p className="text-sm text-muted">אין שיעורים</p>}
          <div className="space-y-2">
            {ls.map((l) => (
              <LessonCard key={l.id} app={app} lesson={l} showDay onClick={() => app.open({ type: 'lesson', id: l.id })} />
            ))}
          </div>
        </section>

        {app.isAdmin && (
          <section className="space-y-3 rounded-2xl border border-line bg-card p-3">
            <h3 className="font-bold">🔑 כניסה למערכת</h3>
            <Chips options={Object.entries(LEVELS).map(([value, label]) => ({ value, label }))} value={level} onChange={changeLevel} />
            <p className="text-sm text-muted">{LEVEL_HELP[level]}</p>
            {link ? (
              <div className="space-y-2 rounded-xl bg-soft p-3">
                <p className="text-sm font-medium">הקישור האישי של {t.first} – לשלוח רק לו/לה:</p>
                <Input readOnly value={link} dir="ltr" onFocus={(e) => e.target.select()} />
                <div className="flex flex-wrap gap-2">
                  {t.phone && (
                    <a className="rounded-xl bg-accent px-4 py-2.5 font-medium text-black" href={whatsapp(t.phone, message)} target="_blank" rel="noreferrer">
                      💬 שליחה בוואטסאפ
                    </a>
                  )}
                  <Button
                    kind="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(link).then(() => app.toast('הקישור הועתק'));
                    }}
                  >
                    📋 העתקה
                  </Button>
                  {navigator.share && (
                    <Button kind="secondary" onClick={() => navigator.share({ title: 'רוק סיטי', text: message }).catch(() => {})}>
                      📤 שיתוף
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button kind="dark" onClick={makeLink}>
                  {t.hasLink ? '🔄 קישור חדש' : '✉️ יצירת קישור כניסה'}
                </Button>
                {t.hasLink && (
                  <>
                    <span className="text-sm text-ok">✓ יש ל{t.first} גישה</span>
                    <Button kind="danger" onClick={revoke}>
                      ביטול גישה
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {(app.isManager || self) && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button kind="secondary" onClick={() => app.open({ type: 'teacherForm', teacher: t })}>
              ✏️ עריכת פרטים
            </Button>
            {app.isAdmin && (
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

export function TeacherForm({ app, panel, onBack }) {
  // panel.admin = הפרטים של המנהל (תמונה, שם, טלפון, מייל – בלי נושאים וצבע)
  const admin = !!panel.admin;
  const editing = !!panel.teacher || admin;
  const [t, setT] = useState(() =>
    admin
      ? { first: '', last: '', phone: '', email: '', subjects: [], ...panel.admin }
      : panel.teacher
      ? { ...panel.teacher }
      : { id: newId('teacher'), first: '', last: '', phone: '', email: '', subjects: [], color: COLORS[app.teachers.length % COLORS.length], notes: '', level: 'edit', photo: '' },
  );
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState('');
  const set = (patch) => setT((x) => ({ ...x, ...patch }));

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      set({ photo: await resizePhoto(file) });
    } catch (err) {
      app.toast(`⚠️ ${err.message}`);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    // התמונה נשלחת רק אם השתנתה
    const photo = t.photo === ((panel.teacher || panel.admin)?.photo || '') ? undefined : t.photo;
    const res = await run(app, '/save', { kind: admin ? 'profile' : 'teacher', item: { ...t, photo } }, editing ? 'הפרטים נשמרו' : 'המורה נוסף');
    setBusy(false);
    if (!res) return;
    if (editing) (onBack || app.close)();
    else app.replace({ type: 'teacher', id: t.id });
  }

  const subjects = [...new Set([...app.settings.subjects, ...t.subjects])];

  return (
    <Sheet title={admin ? 'הפרטים שלי (מנהל)' : editing ? `עריכה – ${fullName(panel.teacher)}` : 'מורה חדש'} onClose={app.close} onBack={onBack}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-center gap-4">
          <Avatar person={t} size={80} />
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-xl border border-line bg-card px-4 py-2.5 font-medium hover:bg-soft">
              📷 {t.photo ? 'החלפת תמונה' : 'הוספת תמונה'}
              <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
            </label>
            {t.photo && (
              <Button kind="ghost" onClick={() => set({ photo: '' })}>
                הסרה
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם פרטי">
            <Input value={t.first} onChange={(e) => set({ first: e.target.value })} required autoFocus={!editing} />
          </Field>
          <Field label="שם משפחה">
            <Input value={t.last} onChange={(e) => set({ last: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="טלפון">
            <Input type="tel" inputMode="tel" value={t.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="מייל">
            <Input type="email" dir="ltr" value={t.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
        {!admin && (
          <>
        <Field label="מה מלמד/ת">
          <Chips multi options={subjects.map((s) => ({ value: s, label: s }))} value={t.subjects} onChange={(v) => set({ subjects: v })} />
          <div className="mt-2 flex gap-2">
            <Input placeholder="נושא אחר (למשל: בס)" value={extra} onChange={(e) => setExtra(e.target.value)} />
            <Button
              kind="secondary"
              disabled={!extra.trim()}
              onClick={() => {
                set({ subjects: [...new Set([...t.subjects, extra.trim()])] });
                setExtra('');
              }}
            >
              הוספה
            </Button>
          </div>
        </Field>
        <Field label="צבע במערכת השעות">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set({ color: c })}
                className={`h-9 w-9 rounded-full border-2 transition ${t.color === c ? 'scale-110 border-ink' : 'border-transparent'}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="הערות">
          <Textarea value={t.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="ימים שבהם זמין/ה, ניסיון..." />
        </Field>
          </>
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
