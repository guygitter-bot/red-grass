import { useMemo, useState } from 'react';
import {
  DAYS,
  PAY_STATE,
  SHORT_DAYS,
  addDays,
  dayOf,
  endTime,
  fromMinutes,
  fullName,
  lessonsOn,
  paymentStatus,
  shortDate,
  showDate,
  statusOn,
  toMinutes,
  today,
  weekStart,
} from '../lib/schedule';
import { Button, Card, Chips, Empty, Select } from './ui';

const PX = 1.15; // גובה של דקה בלוח (פיקסלים)
const isWide = () => window.matchMedia?.('(min-width: 1024px)').matches;
const VIEWS = [
  { value: 'day', label: 'יום' },
  { value: 'week', label: 'שבוע' },
  { value: 'rooms', label: 'לפי חדרים' },
];

// מערכת השעות: יום (רשימה), שבוע (לוח), או יום אחד מחולק לחדרים
export default function Calendar({ app }) {
  const [date, setDate] = useState(today);
  const [view, setView] = useState(() => (isWide() ? 'week' : 'day'));
  const [teacherId, setTeacherId] = useState(() => (app.me.role === 'teacher' ? app.me.id : ''));
  const [roomId, setRoomId] = useState('');
  const [subject, setSubject] = useState('');

  const lessons = useMemo(
    () => app.lessons.filter((l) => (!teacherId || l.teacherId === teacherId) && (!roomId || l.roomId === roomId) && (!subject || l.subject === subject)),
    [app.lessons, teacherId, roomId, subject],
  );
  const start = weekStart(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const now = today();
  const step = view === 'week' ? 7 : 1;

  const openLesson = (l, k) => app.open({ type: 'lesson', id: l.id, date: k });
  const add = (preset = {}) => app.open({ type: 'lessonForm', preset: { teacherId: teacherId || (app.me.role === 'teacher' ? app.me.id : ''), roomId, ...preset } });

  // שבת – רק אם יש בה שיעורים השבוע
  const weekDays = week.filter((k, i) => i < 6 || lessonsOn(lessons, k).length);

  const title =
    view === 'week'
      ? `${shortDate(week[0])} – ${shortDate(week[6])}`
      : `יום ${DAYS[dayOf(date)]} ${showDate(date)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-soft" onClick={() => setDate(addDays(date, -step))} aria-label="אחורה">
            ›
          </button>
          <h1 className="min-w-36 text-center text-lg font-bold">{title}</h1>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-soft" onClick={() => setDate(addDays(date, step))} aria-label="קדימה">
            ‹
          </button>
          {date !== now && (
            <Button kind="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => setDate(now)}>
              היום
            </Button>
          )}
        </div>
        <div className="ms-auto">
          <Chips options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select className="!w-auto !py-1.5 text-sm" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="מורה">
          <option value="">כל המורים</option>
          {app.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === app.me.id ? `השיעורים שלי (${fullName(t)})` : fullName(t)}
            </option>
          ))}
        </Select>
        {view !== 'rooms' && (
          <Select className="!w-auto !py-1.5 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="חדר">
            <option value="">כל החדרים</option>
            {app.settings.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        )}
        <Select className="!w-auto !py-1.5 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="נושא">
          <option value="">כל הנושאים</option>
          {app.settings.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {app.canEdit && (
          <Button className="ms-auto" onClick={() => add(view === 'week' ? {} : { date })}>
            + שיעור
          </Button>
        )}
      </div>

      {view !== 'week' && (
        <div className="grid grid-cols-7 gap-1">
          {week.map((k, i) => {
            const n = lessonsOn(lessons, k).filter((l) => statusOn(l, k) !== 'cancelled').length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setDate(k)}
                className={`rounded-xl border py-1.5 text-center transition ${k === date ? 'border-accent bg-accent text-black' : 'border-line bg-card hover:bg-soft'} ${k === now && k !== date ? 'ring-2 ring-accent' : ''}`}
              >
                <div className="text-xs">{SHORT_DAYS[i]}</div>
                <div className="font-bold">{Number(k.slice(8))}</div>
                <div className={`text-[10px] ${k === date ? 'text-black/70' : 'text-muted'}`}>{n === 1 ? 'שיעור 1' : n ? `${n} שיעורים` : '–'}</div>
              </button>
            );
          })}
        </div>
      )}

      {view === 'day' && <DayList app={app} lessons={lessonsOn(lessons, date)} date={date} onOpen={openLesson} onAdd={() => add({ date })} />}

      {view === 'week' && (
        <TimeGrid
          app={app}
          columns={weekDays.map((k) => ({ key: k, date: k, label: DAYS[dayOf(k)], sub: shortDate(k), today: k === now, items: lessonsOn(lessons, k) }))}
          onOpen={openLesson}
          onAdd={app.canEdit ? (col, start) => add({ date: col.date, start }) : null}
        />
      )}

      {view === 'rooms' && (
        <TimeGrid
          app={app}
          hideRoom
          columns={[
            ...app.settings.rooms.map((r) => ({ key: r.id, date, roomId: r.id, label: r.name, items: lessonsOn(lessons, date).filter((l) => l.roomId === r.id) })),
            ...(lessonsOn(lessons, date).some((l) => !app.roomMap[l.roomId])
              ? [{ key: 'none', date, label: 'בלי חדר', items: lessonsOn(lessons, date).filter((l) => !app.roomMap[l.roomId]) }]
              : []),
          ]}
          onOpen={openLesson}
          onAdd={app.canEdit ? (col, start) => add({ date, start, roomId: col.roomId || '' }) : null}
        />
      )}
    </div>
  );
}

// רשימת השיעורים של יום אחד (בטלפון)
function DayList({ app, lessons, date, onOpen, onAdd }) {
  if (!lessons.length) {
    return (
      <Card>
        <Empty>אין שיעורים ביום הזה</Empty>
        {app.canEdit && (
          <div className="text-center">
            <Button kind="secondary" onClick={onAdd}>
              + הוספת שיעור
            </Button>
          </div>
        )}
      </Card>
    );
  }
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {lessons.map((l) => (
        <LessonCard key={l.id} app={app} lesson={l} date={date} onClick={() => onOpen(l, date)} />
      ))}
    </div>
  );
}

export function LessonCard({ app, lesson: l, date, onClick, showDay = false }) {
  const t = app.teacherMap[l.teacherId];
  const status = date ? statusOn(l, date) : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-stretch gap-3 rounded-2xl border border-line bg-card p-3 text-start shadow-sm transition hover:bg-soft ${status === 'cancelled' ? 'opacity-55' : ''}`}
    >
      <span className="w-1.5 shrink-0 rounded-full" style={{ background: t?.color || '#f5b800' }} />
      <span className="w-14 shrink-0 text-center">
        {showDay && <span className="block text-xs text-muted">{l.kind === 'once' ? shortDate(l.date) : `יום ${SHORT_DAYS[l.day]}`}</span>}
        <span className="block font-bold">{l.start}</span>
        <span className="block text-xs text-muted">{endTime(l)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-bold ${status === 'cancelled' ? 'line-through' : ''}`}>
          <StudentNames app={app} lesson={l} />
        </span>
        <span className="block truncate text-sm text-muted">
          {[l.subject, fullName(t), app.roomMap[l.roomId]?.name].filter(Boolean).join(' · ')}
        </span>
      </span>
      {status && <span title={status}>{{ cancelled: '🚫', attended: '✅', absent: '❌' }[status]}</span>}
    </button>
  );
}

// שמות התלמידים, ולמנהלים – נקודה בצבע מצב התשלום
function StudentNames({ app, lesson }) {
  return lesson.studentIds.map((id, i) => {
    const s = app.studentMap[id];
    const pay = app.isManager ? PAY_STATE[paymentStatus(id, app.payments).state] : null;
    return (
      <span key={id}>
        {i > 0 && ', '}
        {pay && pay !== PAY_STATE.ok && <span className={`me-1 inline-block h-2 w-2 rounded-full align-middle ${pay.dot}`} title={pay.label} />}
        {fullName(s)}
      </span>
    );
  });
}

// לוח שעות: עמודות (ימים או חדרים), שיעורים כמלבנים לפי השעה. לחיצה על מקום ריק = שיעור חדש בשעה הזאת
function TimeGrid({ app, columns, onOpen, onAdd, hideRoom = false }) {
  const all = columns.flatMap((c) => c.items);
  const first = Math.min(15 * 60, ...all.map((l) => toMinutes(l.start)));
  const last = Math.max(20 * 60, ...all.map((l) => toMinutes(l.start) + (l.minutes || 45)));
  const from = Math.floor(first / 60) * 60;
  const to = Math.ceil(last / 60) * 60;
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from + i * 60);
  const height = (to - from) * PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex min-w-max" style={{ minWidth: '100%' }}>
        {/* עמודת השעות */}
        <div className="sticky start-0 z-10 w-12 shrink-0 border-e border-line bg-card">
          <div className="h-12 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 -translate-y-2 text-center text-xs text-muted" style={{ top: (h - from) * PX }}>
                {fromMinutes(h)}
              </div>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.key} className="min-w-28 flex-1 border-e border-line last:border-e-0">
            <div className={`sticky top-0 flex h-12 flex-col items-center justify-center border-b border-line text-sm ${col.today ? 'bg-accent text-black' : 'bg-card'}`}>
              <span className="font-bold">{col.label}</span>
              {col.sub && <span className="text-xs opacity-70">{col.sub}</span>}
            </div>
            <div
              className={`relative ${onAdd ? 'cursor-copy' : ''}`}
              style={{ height }}
              onClick={(e) => {
                if (!onAdd || e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                onAdd(col, fromMinutes(from + Math.floor(y / PX / 15) * 15));
              }}
            >
              {hours.map((h) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (h - from) * PX }} />
              ))}
              {lanes(col.items).map(({ lesson: l, lane, of }) => {
                const t = app.teacherMap[l.teacherId];
                const status = statusOn(l, col.date);
                const top = (toMinutes(l.start) - from) * PX;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onOpen(l, col.date)}
                    className={`absolute overflow-hidden rounded-lg border-s-4 p-1 text-start text-xs leading-tight text-ink shadow-sm transition hover:z-10 hover:shadow-md ${status === 'cancelled' ? 'opacity-50' : ''}`}
                    style={{
                      top: top + 1,
                      height: Math.max(22, (l.minutes || 45) * PX - 2),
                      insetInlineStart: `calc(${(lane / of) * 100}% + 2px)`,
                      width: `calc(${100 / of}% - 4px)`,
                      borderColor: t?.color || '#f5b800',
                      background: `color-mix(in srgb, ${t?.color || '#f5b800'} 22%, var(--color-card))`,
                    }}
                  >
                    <span className={`block truncate font-bold ${status === 'cancelled' ? 'line-through' : ''}`}>
                      {status === 'attended' && '✅ '}
                      {status === 'absent' && '❌ '}
                      <StudentNames app={app} lesson={l} />
                    </span>
                    <span className="block truncate opacity-80">
                      {l.start} {l.subject}
                    </span>
                    <span className="block truncate opacity-70">{[fullName(t), hideRoom ? '' : app.roomMap[l.roomId]?.name].filter(Boolean).join(' · ')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// שיעורים חופפים באותה עמודה – זה לצד זה
function lanes(items) {
  const sorted = [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const ends = [];
    const placed = group.map((l) => {
      const s = toMinutes(l.start);
      let lane = ends.findIndex((e) => e <= s);
      if (lane < 0) lane = ends.length;
      ends[lane] = s + (l.minutes || 45);
      return { lesson: l, lane };
    });
    for (const p of placed) out.push({ ...p, of: ends.length });
    group = [];
  };
  for (const l of sorted) {
    const s = toMinutes(l.start);
    if (group.length && s >= groupEnd) flush();
    group.push(l);
    groupEnd = Math.max(group.length > 1 ? groupEnd : 0, s + (l.minutes || 45));
  }
  if (group.length) flush();
  return out;
}
