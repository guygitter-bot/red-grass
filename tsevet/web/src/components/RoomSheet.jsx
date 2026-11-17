// חדר: בוחרים 2-6 בוטים (אפשר עם המנהל) שעובדים יחד על משימה, בלי שאר הצוות.
// room = חדר קיים (לשינוי מי בו), או null לחדר חדש
import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { ROOM_MAX, ROOM_MIN, newRoom, roomReady } from '../lib/convs';
import Avatar from './Avatar';
import { Button, Sheet, inputCls } from './ui';

export default function RoomSheet({ agents, room = null, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState(room?.members || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key) => setMembers((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const ready = roomReady(members);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (room) {
        await api('/app/conv/members', { id: room.id, members });
        onSaved?.();
      } else {
        await newRoom(members, title.trim());
      }
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <Sheet title={room ? 'מי בחדר' : 'חדר חדש'} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        בוחרים {ROOM_MIN}-{ROOM_MAX} בוטים שיעבדו יחד על משימה. רק הם עונים בחדר – שאר הצוות לא משתתף. כדי שמישהו יחלק את העבודה, אפשר לצרף את המנהל.
      </p>
      {!room && (
        <input className={`${inputCls} mb-3`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="שם לחדר (לא חובה), למשל: השקת סדר" maxLength={60} />
      )}
      <ul className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {agents.map((a) => {
          const on = members.includes(a.key);
          return (
            <li key={a.key}>
              <button
                onClick={() => toggle(a.key)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-start ${on ? 'border-accent bg-soft' : 'border-line bg-page hover:bg-soft'}`}
              >
                <Avatar agent={a} agents={agents} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {a.emoji} {a.name}
                  </span>
                  <span className="block truncate text-xs text-muted">{a.short}</span>
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>
                  {on && <Check size={14} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      <Button className="w-full" disabled={busy || !ready} onClick={save}>
        {ready ? (room ? 'שמירה' : `פתיחת חדר עם ${members.length} בוטים`) : `לבחור ${ROOM_MIN}-${ROOM_MAX} בוטים`}
      </Button>
    </Sheet>
  );
}
