import { useEffect, useState } from 'react';
import { describeLesson, fullName, showDate } from '../lib/schedule';
import { run } from './Panels';
import { Button, Card, Empty } from './ui';

const ago = (at) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  return new Date(at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};

const ACTION = { save: 'שינוי', remove: 'מחיקה', occurrence: 'עדכון תאריך' };
const STATUS_TEXT = { cancelled: 'ביטול', attended: 'הגיע', absent: 'לא הגיע', '': 'רגיל' };

// התראות ובקשות לשינוי
export default function Inbox({ app }) {
  const [busy, setBusy] = useState('');
  const unread = app.notes.filter((n) => !n.read).length;

  // מסמנים כנקרא כמה שניות אחרי שנכנסים
  useEffect(() => {
    if (!unread) return undefined;
    const t = setTimeout(() => {
      app.act('/read', { ids: 'all' }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [unread, app]);

  const forMe = app.requests.filter((r) => r.status === 'pending' && (r.to === app.me.id || app.isManager));
  const mine = app.requests.filter((r) => r.from === app.me.id && !forMe.includes(r));

  async function answer(r, approve) {
    setBusy(r.id);
    await run(app, '/answer', { id: r.id, approve }, approve ? 'אושר – השיעור עודכן' : 'הבקשה נדחתה');
    setBusy('');
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">התראות ובקשות</h1>

      {forMe.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">📨 מחכות לאישור ({forMe.length})</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {forMe.map((r) => (
              <Card key={r.id} className="space-y-2 !p-3">
                <RequestText app={app} r={r} />
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={busy === r.id} onClick={() => answer(r, true)}>
                    ✓ אישור
                  </Button>
                  <Button kind="secondary" className="flex-1" disabled={busy === r.id} onClick={() => answer(r, false)}>
                    ✕ דחייה
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold">🔔 התראות</h2>
        {app.notes.length === 0 ? (
          <Card>
            <Empty>אין התראות</Empty>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {app.notes.map((n) => (
              <button
                key={n.id}
                type="button"
                disabled={!n.lessonId}
                onClick={() => app.open({ type: 'lesson', id: n.lessonId })}
                className={`flex w-full items-start gap-3 border-b border-line p-3 text-start last:border-b-0 enabled:hover:bg-soft ${n.read ? '' : 'bg-soft/60'}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`} />
                <span className="min-w-0 flex-1 text-sm">{n.text}</span>
                <span className="shrink-0 text-xs text-muted">{ago(n.at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">📤 בקשות ששלחתי</h2>
          <div className="space-y-2">
            {mine.slice(0, 20).map((r) => (
              <Card key={r.id} className="!p-3 text-sm">
                <RequestText app={app} r={r} />
                <p className="mt-1 font-medium">
                  {{ pending: '⏳ ממתינה', approved: `✅ אושרה${r.by ? ` (${r.by})` : ''}`, rejected: `❌ נדחתה${r.by ? ` (${r.by})` : ''}`, failed: '⚠️ לא בוצעה' }[r.status]}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// מה ביקשו: לפני ואחרי
function RequestText({ app, r }) {
  const lesson = app.lessons.find((l) => l.id === r.lessonId);
  const from = app.teacherMap[r.from];
  const to = app.teacherMap[r.to];
  return (
    <div className="space-y-1 text-sm">
      <p>
        <b>{fullName(from)}</b> מבקש/ת {ACTION[r.action]} בשיעור של <b>{fullName(to)}</b>
        <span className="text-muted"> · {ago(r.at)}</span>
      </p>
      {lesson && <p className="text-muted">עכשיו: {describeLesson(lesson, app.students)}</p>}
      {r.action === 'save' && <p>{lesson ? 'אחרי: ' : 'שיעור חדש: '}{describeLesson(r.data, app.students)}{r.data.roomId && ` · ${app.roomMap[r.data.roomId]?.name || ''}`}</p>}
      {r.action === 'remove' && <p className="text-danger">למחוק את השיעור</p>}
      {r.action === 'occurrence' && (
        <p>
          ב־{showDate(r.data.date)}: {STATUS_TEXT[r.data.status]}
          {r.data.note && ` – ${r.data.note}`}
        </p>
      )}
    </div>
  );
}
