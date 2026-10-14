import { useState } from 'react';
import { DAYS, addDays, dayOf, fromMinutes, fullName, hoursOf, roomDay, shortDate, today, toMinutes, weekStart } from '../lib/schedule';
import { Button, Card } from './ui';

// חדרים: לכל חדר – מתי הוא פנוי ומתי תפוס, יום אחרי יום בשבוע שנבחר. לחיצה על זמן פנוי = שיעור חדש שם
export default function Rooms({ app }) {
  const [roomId, setRoomId] = useState(app.settings.rooms[0]?.id || '');
  const [date, setDate] = useState(today);
  const hours = hoursOf(app.settings);
  const now = today();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));
  const room = app.roomMap[roomId] || app.settings.rooms[0];
  // שבת – רק אם יש בה שיעורים בחדר
  const days = week.filter((k, i) => i < 6 || roomDay(app.lessons, room?.id, k, hours).busy.length);

  // עכשיו: פנוי, או תפוס עד מתי
  const status = (r) => {
    const b = roomDay(app.lessons, r.id, now, hours).busy.find((x) => x.start <= nowMin && nowMin < x.end);
    return b ? `תפוס עד ${fromMinutes(b.end)}` : 'פנוי עכשיו';
  };
  // כמה שעות תפוס השבוע
  const weekHours = (r) => Math.round(week.reduce((n, k) => n + roomDay(app.lessons, r.id, k, hours).busy.reduce((m, b) => m + b.end - b.start, 0), 0) / 6) / 10;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🚪 חדרים</h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {app.settings.rooms.map((r) => {
          const st = status(r);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoomId(r.id)}
              className={`rounded-2xl border p-3 text-start shadow-sm transition ${r.id === room?.id ? 'border-accent bg-accent text-black' : 'border-line bg-card hover:bg-soft'}`}
            >
              <span className="block font-bold">{r.name}</span>
              <span className={`block text-sm ${r.id === room?.id ? '' : st.startsWith('פנוי') ? 'text-ok' : 'text-danger'}`}>● {st}</span>
              <span className={`block text-xs ${r.id === room?.id ? 'text-black/70' : 'text-muted'}`}>{weekHours(r)} שעות תפוס השבוע</span>
            </button>
          );
        })}
      </div>

      {room && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{room.name} – מתי פנוי?</h2>
            <div className="ms-auto flex items-center gap-1">
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-soft" onClick={() => setDate(addDays(date, -7))} aria-label="שבוע קודם">
                ›
              </button>
              <span className="min-w-24 text-center text-sm font-medium">
                {shortDate(week[0])} – {shortDate(week[6])}
              </span>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-soft" onClick={() => setDate(addDays(date, 7))} aria-label="שבוע הבא">
                ‹
              </button>
              {weekStart(date) !== weekStart(now) && (
                <Button kind="secondary" className="!px-3 !py-1 text-sm" onClick={() => setDate(now)}>
                  השבוע
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            שעות הפעילות {hours.from} עד {hours.to} (משנים ב"עוד"). <span className="text-ok">ירוק = פנוי</span>
            {app.canEdit && ' – לחיצה על זמן פנוי פותחת שיעור חדש בחדר הזה'}.
          </p>
          <div className="divide-y divide-line">
            {days.map((k) => (
              <RoomDayRow key={k} app={app} room={room} date={k} hours={hours} past={k < now} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RoomDayRow({ app, room, date, hours, past }) {
  const { busy, free } = roomDay(app.lessons, room.id, date, hours);
  const open = toMinutes(hours.from);
  const span = toMinutes(hours.to) - open;
  const pos = (a, b) => ({ insetInlineStart: `${((a - open) / span) * 100}%`, width: `${((b - a) / span) * 100}%` });
  const add = (f) => app.open({ type: 'lessonForm', preset: { date, start: fromMinutes(f.start), roomId: room.id } });
  const isToday = date === today();

  return (
    <div className={`py-3 ${past ? 'opacity-50' : ''}`}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className={`font-bold ${isToday ? 'rounded-full bg-accent px-2 text-black' : ''}`}>יום {DAYS[dayOf(date)]}</span>
        <span className="text-xs text-muted">{shortDate(date)}</span>
        <span className="ms-auto text-xs text-muted">{busy.length ? `${busy.length} שיעורים` : 'פנוי כל היום'}</span>
      </div>
      {/* פס הזמן: ירוק פנוי, צבע המורה = שיעור */}
      <div className="relative h-9 overflow-hidden rounded-lg bg-line/60">
        {free.map((f) => (
          <button
            key={f.start}
            type="button"
            disabled={!app.canEdit}
            onClick={() => add(f)}
            title={`פנוי ${fromMinutes(f.start)}–${fromMinutes(f.end)}`}
            className="absolute inset-y-0 border-x border-card bg-ok/25 transition enabled:hover:bg-ok/40"
            style={pos(f.start, f.end)}
          />
        ))}
        {busy.map((b) => {
          const t = app.teacherMap[b.lesson.teacherId];
          return (
            <button
              key={b.lesson.id}
              type="button"
              onClick={() => app.open({ type: 'lesson', id: b.lesson.id, date })}
              title={`${b.lesson.start} ${b.lesson.subject} – ${fullName(t)}`}
              aria-label={`${b.lesson.start} ${b.lesson.subject}`}
              className="absolute inset-y-0 border-x border-card"
              style={{ ...pos(b.start, Math.min(b.end, open + span)), background: t?.color || '#f5b800' }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
        {free.length === 0 && <span className="text-danger">תפוס כל היום</span>}
        {[...busy.map((x) => ({ ...x, busy: true })), ...free].sort((x, y) => x.start - y.start).map((x) =>
          x.busy ? (
            <button
              key={x.lesson.id}
              type="button"
              onClick={() => app.open({ type: 'lesson', id: x.lesson.id, date })}
              className="rounded-full bg-line/70 px-2.5 py-0.5 text-muted hover:bg-line"
            >
              תפוס {fromMinutes(x.start)} עד {fromMinutes(x.end)} · {app.teacherMap[x.lesson.teacherId]?.first}
            </button>
          ) : (
            <button
              key={x.start}
              type="button"
              disabled={!app.canEdit}
              onClick={() => add(x)}
              className="rounded-full bg-ok/15 px-2.5 py-0.5 text-ok enabled:hover:bg-ok/25"
            >
              פנוי {fromMinutes(x.start)} עד {fromMinutes(x.end)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
