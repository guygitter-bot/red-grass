import { useState } from 'react';
import { LEVELS, LEVEL_HELP, newId } from '../lib/schedule';
import { run } from './Panels';
import { Avatar, Button, Card, Field, Input } from './ui';

// הגדרות: הפרופיל שלי, חדרים ונושאים, חשבון המנהל, גיבוי ויומן שינויים
export default function More({ app, signOut }) {
  const self = app.teacherMap[app.me.id];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          {self ? <Avatar person={self} size={56} /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl">👑</span>}
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{app.me.name}</div>
            <div className="text-sm text-muted">{app.isAdmin ? `מנהל המערכת (${app.me.username})` : LEVELS[app.me.level]}</div>
          </div>
        </div>
        {!app.isAdmin && <p className="text-sm text-muted">{LEVEL_HELP[app.me.level]}</p>}
        <div className="flex flex-wrap gap-2">
          {self && (
            <Button kind="secondary" onClick={() => app.open({ type: 'teacherForm', teacher: self })}>
              ✏️ הפרטים שלי
            </Button>
          )}
          <Button
            kind="ghost"
            onClick={() => {
              if (window.confirm(app.isAdmin ? 'לצאת מהמערכת?' : 'לצאת? כדי להיכנס שוב צריך את הקישור האישי מהמנהל.')) signOut();
            }}
          >
            יציאה
          </Button>
        </div>
      </Card>

      {app.isManager && <Places app={app} />}
      {app.isAdmin && <Account app={app} />}
      {app.isAdmin && <Permissions />}
      {app.isManager && <Backup app={app} />}
      {app.isManager && <Log app={app} />}
    </div>
  );
}

// חדרים ונושאים (גיטרה, תופים...) – אפשר להוסיף, לשנות שם ולמחוק
function Places({ app }) {
  const [rooms, setRooms] = useState(app.settings.rooms);
  const [subjects, setSubjects] = useState(app.settings.subjects);
  const [newSubject, setNewSubject] = useState('');
  const changed = JSON.stringify({ rooms, subjects }) !== JSON.stringify(app.settings);

  function removeRoom(r) {
    const used = app.lessons.filter((l) => l.roomId === r.id).length;
    if (used && !window.confirm(`יש ${used} שיעורים ב${r.name}. הם יישארו בלי חדר. למחוק?`)) return;
    setRooms(rooms.filter((x) => x.id !== r.id));
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-bold">🚪 חדרים ונושאים</h2>
      <div className="space-y-2">
        {rooms.map((r, i) => (
          <div key={r.id} className="flex gap-2">
            <Input value={r.name} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="שם החדר" />
            <Button kind="ghost" onClick={() => removeRoom(r)} disabled={rooms.length < 2} aria-label="מחיקה">
              🗑️
            </Button>
          </div>
        ))}
        <Button kind="secondary" onClick={() => setRooms([...rooms, { id: newId('room'), name: `חדר ${rooms.length + 1}` }])}>
          + חדר
        </Button>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded-full bg-soft px-3 py-1 text-sm">
              {s}
              <button type="button" className="text-muted" onClick={() => setSubjects(subjects.filter((x) => x !== s))} aria-label={`מחיקת ${s}`} disabled={subjects.length < 2}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="נושא חדש (למשל: בס, יוקללה, הרכב)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          <Button
            kind="secondary"
            disabled={!newSubject.trim()}
            onClick={() => {
              setSubjects([...new Set([...subjects, newSubject.trim()])]);
              setNewSubject('');
            }}
          >
            הוספה
          </Button>
        </div>
      </div>
      {changed && (
        <Button className="w-full" onClick={() => run(app, '/save', { kind: 'settings', item: { rooms, subjects } }, 'נשמר')}>
          שמירת השינויים
        </Button>
      )}
    </Card>
  );
}

function Account({ app }) {
  const [username, setUsername] = useState(app.me.username || '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function save(e) {
    e.preventDefault();
    const res = await run(app, '/account', { password, username, newPassword: newPassword || undefined }, 'החשבון עודכן');
    if (res) {
      setPassword('');
      setNewPassword('');
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <h2 className="text-lg font-bold">👑 חשבון המנהל</h2>
        <Field label="שם משתמש">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="סיסמה חדשה (לא חובה)">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="הסיסמה הנוכחית (לאישור)">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Button type="submit" kind="secondary">
          עדכון
        </Button>
      </form>
    </Card>
  );
}

function Permissions() {
  return (
    <Card className="space-y-2">
      <h2 className="text-lg font-bold">🔑 הרשאות של מורים</h2>
      <p className="text-sm text-muted">נותנים הרשאה ושולחים קישור כניסה מהכרטיס של כל מורה (מורים ← לוחצים על המורה).</p>
      {Object.entries(LEVELS).map(([k, label]) => (
        <p key={k} className="text-sm">
          <b>{label}:</b> {LEVEL_HELP[k]}
        </p>
      ))}
    </Card>
  );
}

// הורדת כל הנתונים לקובץ (גיבוי)
function Backup({ app }) {
  function download() {
    const { settings, teachers, students, lessons, payments } = app;
    const data = { exported: new Date().toISOString(), settings, teachers: teachers.map(({ photo, ...t }) => t), students, lessons, payments };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rock-city-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card className="space-y-2">
      <h2 className="text-lg font-bold">💾 גיבוי</h2>
      <p className="text-sm text-muted">קובץ עם כל המורים, התלמידים, השיעורים והתשלומים – לשמור במחשב מדי פעם.</p>
      <Button kind="secondary" onClick={download}>
        הורדת גיבוי
      </Button>
    </Card>
  );
}

function Log({ app }) {
  const [all, setAll] = useState(false);
  const list = all ? app.log : app.log.slice(0, 15);
  return (
    <Card className="lg:col-span-2">
      <h2 className="mb-2 text-lg font-bold">📜 יומן שינויים</h2>
      {list.length === 0 && <p className="text-sm text-muted">עוד אין שינויים</p>}
      <div className="divide-y divide-line text-sm">
        {list.map((l, i) => (
          <div key={i} className="flex gap-3 py-1.5">
            <span className="w-24 shrink-0 text-xs text-muted">{new Date(l.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="min-w-0 flex-1">
              <b>{l.who}</b> {l.text}
            </span>
          </div>
        ))}
      </div>
      {app.log.length > 15 && (
        <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => setAll(!all)}>
          {all ? 'פחות' : 'הכול'}
        </button>
      )}
    </Card>
  );
}
