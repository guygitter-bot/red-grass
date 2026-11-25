// הגדרות: רמת חוכמה לכל בוט, מה הצוות למד (Skills.jsx), מה הצוות זוכר, תצוגה, סיסמה, יציאה
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { TIERS } from '../lib/agents';
import { getTheme, setTheme } from '../lib/theme';
import Skills from './Skills';
import MetaSettings from './MetaSettings';
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push';
import { Button, Segmented, inputCls } from './ui';

function Card({ title, id, children }) {
  return (
    <section id={id} className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Models({ agents }) {
  const [models, setModels] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api('/app/settings', {})
      .then((r) => setModels(r.models || {}))
      .catch((e) => setError(e.message));
  }, []);

  const pick = async (key, tier) => {
    const before = models;
    setModels({ ...models, [key]: tier });
    try {
      const r = await api('/app/settings', { models: { [key]: tier } });
      setModels(r.models || {});
      setError('');
    } catch (e) {
      setModels(before);
      setError(e.message);
    }
  };

  return (
    <Card title="כמה חכם כל בוט">
      <p className="mb-3 text-sm text-muted">חזק = חכם יותר ויקר יותר. חסכוני = מהיר וזול. בכל רמה Fable 5.2 משמש יועץ בשלבים החשובים.</p>
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      <ul className="space-y-3">
        {agents.map((a) => (
          <li key={a.key}>
            <div className="mb-1 text-sm font-medium">
              {a.emoji} {a.name}
            </div>
            <Segmented value={models[a.key] || a.tier} options={TIERS} onChange={(t) => pick(a.key, t)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Memory() {
  const [notes, setNotes] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/app/memory')
      .then((r) => setNotes(r.notes))
      .catch((e) => setError(e.message));
  }, []);

  const call = async (path, body) => {
    try {
      const r = await api(path, body);
      setNotes(r.notes);
      setError('');
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  return (
    <Card title="מה הצוות זוכר">
      <p className="mb-3 text-sm text-muted">דברים שהצוות יודע עליך ועל העסק, בכל שיחה.</p>
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      {notes?.length === 0 && <p className="mb-3 text-sm text-muted">עוד לא נשמר כלום.</p>}
      <ul className="mb-3 space-y-2">
        {notes?.map((t, i) => (
          <li key={`${i}-${t}`} className="flex items-start gap-2 rounded-xl bg-soft px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 break-words">{t}</span>
            <button onClick={() => call('/app/memory/delete', { number: i + 1, text: t })} className="p-1 text-muted hover:text-bad" aria-label="מחיקה">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim()) return;
          if (await call('/app/memory/add', { note: note.trim() })) setNote('');
        }}
      >
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="להוסיף משהו שכדאי לזכור…" />
        <Button disabled={!note.trim()}>הוספה</Button>
      </form>
    </Card>
  );
}

// התראות לטלפון: הפעלה במכשיר הזה, בדיקה, והאם גם משימה רגילה שולחת
function Notifications() {
  const [on, setOn] = useState(false);
  const [notifyAll, setNotifyAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    if (supported) currentSubscription().then((s) => setOn(!!s));
    api('/app/settings', {})
      .then((r) => setNotifyAll(!!r.notifyAll))
      .catch(() => {});
  }, [supported]);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setBad(false);
      setMsg(ok || '');
    } catch (e) {
      setBad(true);
      setMsg(e.message);
    }
    setBusy(false);
  };

  const toggleAll = async () => {
    const next = !notifyAll;
    setNotifyAll(next);
    try {
      const r = await api('/app/settings', { notifyAll: next });
      setNotifyAll(!!r.notifyAll);
    } catch (e) {
      setNotifyAll(!next);
      setBad(true);
      setMsg(e.message);
    }
  };

  return (
    <Card title="התראות לטלפון" id="notifications">
      {!supported ? (
        <p className="text-sm text-muted">בטלפון צריך קודם להוסיף את האפליקציה למסך הבית (באייפון – חובה), ואז לפתוח אותה משם ולחזור לכאן.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{on ? 'ההתראות פועלות במכשיר הזה.' : 'כדי לדעת כשמשימה הסתיימה, גם כשהאפליקציה סגורה.'}</p>
          <div className="flex flex-wrap gap-2">
            {on ? (
              <Button kind="ghost" disabled={busy} onClick={() => run(async () => { await disablePush(); setOn(false); }, 'ההתראות כובו')}>
                לכבות
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => run(async () => { await enablePush(); setOn(true); }, 'ההתראות הופעלו')}>
                להפעיל התראות במכשיר הזה
              </Button>
            )}
            {on && (
              <Button
                kind="ghost"
                disabled={busy}
                onClick={() => run(async () => { const r = await api('/app/push/test', {}); setMsg(r.sent ? 'נשלחה התראה' : 'לא נשלחה התראה – כדאי לכבות ולהפעיל שוב'); }, '')}
              >
                לשלוח התראת בדיקה
              </Button>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">גם כשמשימה רגילה מסתיימת</div>
              <div className="text-xs text-muted">משימות קבועות שולחות התראה תמיד</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifyAll}
              aria-label="גם כשמשימה רגילה מסתיימת"
              onClick={toggleAll}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notifyAll ? 'bg-accent' : 'bg-line'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${notifyAll ? 'right-0.5' : 'right-[1.375rem]'}`} />
            </button>
          </div>
        </>
      )}
      {msg && <p className={`mt-2 text-sm ${bad ? 'text-bad' : 'text-ok'}`}>{msg}</p>}
    </Card>
  );
}

function Password() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBad(true);
    if (next !== again) return setMsg('הסיסמאות החדשות לא זהות');
    try {
      const r = await api('/app/password', { password: cur, newPassword: next });
      setToken(r.token);
      setMsg('הסיסמה הוחלפה');
      setBad(false);
      setCur('');
      setNext('');
      setAgain('');
      setOpen(false);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <Card title="סיסמה">
      {!open ? (
        <Button kind="ghost" onClick={() => setOpen(true)}>
          החלפת סיסמה
        </Button>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <input type="password" className={inputCls} placeholder="הסיסמה הנוכחית" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <input type="password" className={inputCls} placeholder="סיסמה חדשה (לפחות 6 תווים)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <input type="password" className={inputCls} placeholder="שוב את החדשה" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
          <Button disabled={!cur || next.length < 6}>שמירה</Button>
        </form>
      )}
      {msg && <p className={`mt-2 text-sm ${bad ? 'text-bad' : 'text-ok'}`}>{msg}</p>}
    </Card>
  );
}

export default function Settings({ team, onLogout }) {
  const [theme, setT] = useState(getTheme());

  const logout = async () => {
    try {
      await api('/app/logout', {});
    } catch {
      // יוצאים בכל מקרה
    }
    setToken('');
    onLogout();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Models agents={team?.agents || []} />
      <Skills agents={team?.agents || []} connected={team?.maagar} />
      <Memory />
      <Notifications />
      <Card title="פייסבוק ואינסטגרם" id="meta">
        <MetaSettings />
      </Card>
      <Card title="תצוגה">
        <Segmented
          value={theme}
          options={[
            ['auto', 'אוטומטי'],
            ['light', 'יום'],
            ['dark', 'לילה'],
          ]}
          onChange={(t) => {
            setT(t);
            setTheme(t);
          }}
        />
      </Card>
      <Password />
      <Button kind="danger" className="w-full" onClick={logout}>
        יציאה
      </Button>
    </div>
  );
}
