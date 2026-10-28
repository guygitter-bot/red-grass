import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Bot, Bug, CheckCircle2, ImagePlus, X, ChefHat, DollarSign, LayoutDashboard, Loader2, LogOut, RefreshCw, Shield, Star, Users,
} from 'lucide-react';
import { ISSUE_STATUS, SECURITY, SOURCES, ago, api, lastDays, shrinkImage, usd } from './lib';

// אפליקציית הניהול של mat-kon: רק לבעל האפליקציה (כניסה עם סיסמת הבעלים; הכול נבדק בשרת)
const TABS = [
  ['overview', 'סקירה', LayoutDashboard], ['users', 'משתמשים', Users], ['money', 'כסף', DollarSign],
  ['issues', 'תקלות', Bug], ['security', 'אבטחה', Shield], ['content', 'תוכן', ChefHat],
];

export default function App() {
  const [session, setSession] = useState(() => localStorage.getItem('admin_session') || '');
  // לשונית מהכתובת (#issues, #content) – כך לחיצה על התראה פותחת ישר את המקום הנכון
  const [tab, setTabState] = useState(() => (TABS.some(([id]) => `#${id}` === window.location.hash) ? window.location.hash.slice(1) : 'overview'));
  const setTab = useCallback((id) => {
    setTabState(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (TABS.some(([t]) => t === id)) setTabState(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(() => {
    localStorage.removeItem('admin_session');
    setSession('');
    setData(null);
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const [overview, issues, security, reports, talk] = await Promise.all([
        api(session, 'GET', '/admin/overview'), api(session, 'GET', '/admin/issues'), api(session, 'GET', '/admin/security'), api(session, 'GET', '/admin/reports'),
        api(session, 'GET', '/admin/talk').catch(() => ({ items: [] })),
      ]);
      setData({ ...overview, issueList: issues.issues, noRecipeList: issues.noRecipe || [], security, reportList: reports.items, talkList: talk.items });
    } catch (e) {
      if (e.status === 401 || e.status === 403) signOut();
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [session, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) return <Login onDone={(s) => { localStorage.setItem('admin_session', s); setSession(s); }} />;

  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <div className="flex-1 font-black">mat-kon <span className="text-muted font-medium">ניהול</span></div>
          <button onClick={load} disabled={busy} className="p-2 rounded-full hover:bg-page" aria-label="רענון">
            {busy ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          </button>
          <button onClick={signOut} className="p-2 rounded-full hover:bg-page" aria-label="יציאה"><LogOut size={20} /></button>
        </div>
        <nav className="hidden lg:flex max-w-5xl mx-auto px-4 gap-1 pb-2">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 ${tab === id ? 'bg-ink text-card' : 'hover:bg-page'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4">
        {error && <p className="mb-3 rounded-xl bg-red-500/10 text-red-600 p-3 text-sm">{error}</p>}
        {!data ? (
          <div className="py-20 flex justify-center text-muted"><Loader2 className="animate-spin" size={28} /></div>
        ) : (
          <>
            {tab === 'overview' && <Overview d={data} go={setTab} session={session} />}
            {tab === 'users' && <UsersTab d={data} session={session} />}
            {tab === 'money' && <Money d={data} session={session} reload={load} />}
            {tab === 'issues' && <Issues list={data.issueList} noRecipe={data.noRecipeList} session={session} reload={load} />}
            {tab === 'security' && <Security d={data} />}
            {tab === 'content' && <Content d={data} session={session} reload={load} />}
          </>
        )}
      </main>

      {/* תפריט תחתון בטלפון */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t border-line pb-[env(safe-area-inset-bottom)] grid grid-cols-6">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`relative py-2 flex flex-col items-center gap-0.5 text-[11px] ${tab === id ? 'text-brand font-bold' : 'text-muted'}`}>
            <Icon size={20} />
            {label}
            {id === 'issues' && data?.issues.new > 0 && <span className="absolute top-1.5 right-1/2 mr-[-14px] w-2 h-2 rounded-full bg-red-500" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('', 'POST', '/owner-login', { password });
      onDone(res.session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-sm border border-line">
        <h1 className="text-2xl font-black">mat-kon ניהול</h1>
        <p className="text-muted text-sm mt-1 mb-5">כניסה עם סיסמת הבעלים</p>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמת הבעלים" autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-page px-3 py-3 outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button disabled={busy || !password} className="mt-4 w-full rounded-xl bg-brand text-white font-bold py-3 disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'כניסה'}
        </button>
      </form>
    </div>
  );
}

const Card = ({ title, children, className = '' }) => (
  <section className={`bg-card rounded-2xl border border-line p-4 ${className}`}>
    {title && <h2 className="font-bold mb-3">{title}</h2>}
    {children}
  </section>
);

const Stat = ({ label, value, sub, onClick }) => (
  <button onClick={onClick} disabled={!onClick} className="bg-card rounded-2xl border border-line p-3 text-right">
    <div className="text-xs text-muted">{label}</div>
    <div className="text-2xl font-black mt-0.5">{value}</div>
    {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
  </button>
);

const LEVEL = { serious: 'bg-red-500/10 text-red-700 dark:text-red-300', warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' };

// הבדיקה הסגורה ב-Google Play: 14 ימים רצופים לפני שאפשר לבקש גישה לייצור.
// ברירת המחדל – היום ה-8 היה ב-28.10.2026; אפשר לתקן את התאריך במסך
const PLAY_TEST_START = '2026-10-20';
const PLAY_TEST_DAYS = 14;

function PlayTest({ start, session }) {
  const [date, setDate] = useState(start);
  const [editing, setEditing] = useState(false);
  const day = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
  const today = day(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }));
  const passed = Math.max(0, today - day(date));
  const left = Math.max(0, PLAY_TEST_DAYS - passed);
  const end = new Date((day(date) + PLAY_TEST_DAYS) * 86400000).toLocaleDateString('he-IL', { timeZone: 'UTC' });
  const save = async () => {
    await api(session, 'PUT', '/admin/settings', { testStart: date });
    setEditing(false);
  };
  return (
    <Card title="בדיקה סגורה ב-Google Play">
      {left > 0 ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{left}</span>
            <span className="text-sm">{left === 1 ? 'יום נשאר' : 'ימים נשארו'} · עברו {passed} מתוך {PLAY_TEST_DAYS}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${(passed / PLAY_TEST_DAYS) * 100}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">אפשר להגיש בקשה לייצור החל מ-{end}</p>
        </>
      ) : (
        <p className="text-sm">
          ✅ עברו {PLAY_TEST_DAYS} ימים – אפשר להגיש בקשה לגישה לייצור:{' '}
          <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer" className="text-brand underline">Play Console</a> ← מרכז שליטה
        </p>
      )}
      {editing ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          תחילת הבדיקה:
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1" />
          <button onClick={save} className="rounded-full bg-brand text-white px-3 py-1">שמירה</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="mt-2 text-xs text-muted underline">תיקון תאריך ההתחלה</button>
      )}
    </Card>
  );
}

function Overview({ d, go, session }) {
  const s = d.stats;
  return (
    <div className="space-y-4">
      {d.alerts.length > 0 ? (
        <div className="space-y-2">
          {d.alerts.map((a, i) => (
            <div key={i} className={`rounded-xl p-3 text-sm flex gap-2 items-start ${LEVEL[a.level]}`}>
              <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {a.text}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-3 text-sm flex gap-2 items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={18} /> הכול תקין – אין התראות
        </div>
      )}

      <PushCard session={session} />
      <PlayTest start={d.settings.testStart || PLAY_TEST_START} session={session} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="משתמשים" value={s.users} sub={`+${s.today} היום · +${s.week} השבוע`} onClick={() => go('users')} />
        <Stat label="פעילים ב-7 ימים" value={s.active7} sub={`${s.active30} ב-30 ימים`} />
        <Stat label="הוצאה החודש (AI)" value={usd(d.costs[0].usd)} sub={`חודש קודם ${usd(d.costs[1].usd)}`} onClick={() => go('money')} />
        <Stat label="תקלות פתוחות" value={d.issues.open} sub={`${d.issues.new} חדשות`} onClick={() => go('issues')} />
      </div>

      <Card title="הרשמות ב-30 הימים האחרונים">
        <SignupChart byDay={s.signupsByDay} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="מסלולים">
          <Rows rows={[
            ['💳 משלמים', s.plans.paying, 'יתחיל לספור כשנחבר תשלומים'],
            ['🎁 מנוי חינם (ממך)', s.plans.gifted],
            [`🆓 חינמי (${s.freeLimit} מתכונים)`, s.plans.free],
            ['⚠️ הגיעו לתקרה – כדאי לפנות', s.plans.atLimit],
          ]} />
        </Card>
        <Card title="מאיפה הגיעו">
          <Rows rows={Object.entries(SOURCES).map(([k, label]) => [label, s.sources[k] || 0])} />
        </Card>
      </div>
    </div>
  );
}

// התראות לטלפון: תקלה חדשה / תקלה שחזרה / מתכון בקהילה שמחכה לבדיקה – קופצות עם צליל ורטט
function PushCard({ session }) {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [state, setState] = useState('loading'); // loading | on | off | blocked
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!supported) {
      setState('off');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub && Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    setMsg('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setState('blocked');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publicKey } = await api(session, 'GET', '/admin/push/key');
        const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (publicKey.length % 4)) % 4)), (c) => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      await api(session, 'POST', '/admin/push/subscribe', { subscription: sub.toJSON() });
      setState('on');
      await api(session, 'POST', '/admin/push/test');
      setMsg('נשלחה התראת בדיקה – היא אמורה לקפוץ עכשיו.');
    } catch (e) {
      setMsg(e.message || 'לא הצלחתי להפעיל התראות');
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    try {
      const { sent } = await api(session, 'POST', '/admin/push/test');
      setMsg(sent ? 'נשלחה התראת בדיקה.' : 'לא נמצא מכשיר רשום – לחצו "הפעלת התראות".');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-xl">🔔</span>
        <div className="flex-1 text-sm">
          {state === 'on' ? <b>התראות לטלפון פעילות</b> : state === 'blocked' ? 'ההתראות חסומות בדפדפן' : 'קבלו התראה קופצת עם צליל כשיש תקלה'}
          {state === 'blocked' && <div className="text-xs text-muted">כדי לאשר: הגדרות כרום ← הגדרות אתר ← התראות ← mat-kon-admin</div>}
        </div>
        {state === 'on' ? (
          <button disabled={busy} onClick={test} className="text-sm rounded-full border border-line px-3 py-1">בדיקה</button>
        ) : state !== 'blocked' && (
          <button disabled={busy || state === 'loading'} onClick={enable} className="text-sm rounded-full bg-brand text-white font-bold px-3 py-1.5">הפעלת התראות</button>
        )}
      </div>
      {msg && <p className="text-xs text-muted mt-2">{msg}</p>}
    </Card>
  );
}

const Rows = ({ rows }) => (
  <ul className="divide-y divide-line">
    {rows.map(([label, value, hint]) => (
      <li key={label} className="py-2 flex items-center gap-2">
        <span className="flex-1">{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
        <b>{value}</b>
      </li>
    ))}
  </ul>
);

// עמודה לכל יום (סדרה אחת – בלי מקרא); ריחוף/לחיצה מראה את המספר
function SignupChart({ byDay }) {
  const days = lastDays(byDay);
  const max = Math.max(1, ...days.map((d) => d.count));
  const [hover, setHover] = useState(null);
  const shown = hover ?? days[days.length - 1];
  return (
    <div>
      <div className="text-sm text-muted mb-2">
        {new Date(shown.day).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}: <b className="text-ink">{shown.count}</b> הרשמות
      </div>
      <div className="h-32 flex items-end gap-[2px] border-b border-line" dir="ltr" onMouseLeave={() => setHover(null)}>
        {days.map((d) => (
          <button
            key={d.day}
            onMouseEnter={() => setHover(d)}
            onClick={() => setHover(d)}
            className="flex-1 h-full flex items-end group"
            aria-label={`${d.day}: ${d.count}`}
          >
            <span
              className={`w-full rounded-t ${hover?.day === d.day ? 'bg-ink' : 'bg-brand'} ${d.count ? '' : 'opacity-20'}`}
              style={{ height: `${d.count ? Math.max(4, (d.count / max) * 100) : 2}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-1" dir="ltr">
        <span>לפני 30 ימים</span><span>היום</span>
      </div>
    </div>
  );
}

function UsersTab({ d, session }) {
  const s = d.stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="ספרים (בעלי ספר)" value={s.books} />
        <Stat label="נכנסים עם גוגל" value={s.google} />
        <Stat label="מתכונים שנשלחו בקישור" value={s.shares.links} sub={`${s.shares.saves} נשמרו אצל אחרים`} />
        <Stat label="נרשמו החודש" value={s.month} />
      </div>
      <BisFeature session={session} />
      <Card title="נרשמו לאחרונה">
        <ul className="divide-y divide-line">
          {s.recent.map((u) => (
            <li key={u.email} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.name || '—'}</div>
                <div className="text-xs text-muted truncate" dir="ltr">{u.email}</div>
              </div>
              <div className="text-left text-xs text-muted shrink-0">
                <div>{SOURCES[u.source]}</div>
                <div>{u.plan === 'paid' ? 'מנוי' : `${u.added}/${s.freeLimit} מתכונים`}</div>
                <div>נכנס {ago(u.lastSeen)}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ניקוד ביס בדף המתכון – רק למשתמשים שבוחרים כאן (לפי אימייל)
function BisFeature({ session }) {
  const [users, setUsers] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setUsers((await api(session, 'GET', '/admin/features')).users.filter((u) => u.features?.bis));
    } catch (e) {
      setError(e.message);
    }
  }, [session]);
  useEffect(() => {
    load();
  }, [load]);
  const set = async (address, on) => {
    setBusy(true);
    setError('');
    try {
      await api(session, 'POST', '/admin/features', { email: address, feature: 'bis', on });
      setEmail('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="ניקוד ביס בדף המתכון">
      <p className="text-sm text-muted">מי שמופיע כאן רואה בכל מתכון כמה נקודות של ביס יש במנה. אחרי ההפעלה – לסגור ולפתוח אצלו את האפליקציה.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) set(email.trim(), true); }} className="mt-3 flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" placeholder="email@example.com" className="flex-1 min-w-0 rounded-xl border border-line bg-page px-3 py-2 text-sm" />
        <button disabled={busy || !email.trim()} className="rounded-xl bg-brand text-white px-4 text-sm font-medium disabled:opacity-50">הפעלה</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {users && !users.length && <p className="mt-3 text-sm text-muted">עוד לא הופעל לאף משתמש</p>}
      <ul className="mt-2 divide-y divide-line">
        {(users || []).map((u) => (
          <li key={u.email} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{u.name || '—'}</div>
              <div className="text-xs text-muted truncate" dir="ltr">{u.email}</div>
            </div>
            <button disabled={busy} onClick={() => set(u.email, false)} className="text-sm rounded-full border border-line px-3 py-1 disabled:opacity-50">כיבוי</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Money({ d, session, reload }) {
  const [alert, setAlert] = useState(d.settings.spendAlert || '');
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await api(session, 'PUT', '/admin/settings', { spendAlert: Number(alert) || 0 });
    setSaved(true);
    reload();
  };
  const users = d.stats.users || 1;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {d.costs.map((c) => <Stat key={c.month} label={c.month} value={usd(c.usd)} />)}
      </div>
      <Card title="עלות ממוצעת למשתמש החודש">
        <div className="text-2xl font-black">{usd(d.costs[0].usd / users)}</div>
        <p className="text-xs text-muted mt-1">רק עלויות AI (Claude). השרתים (Cloudflare) ושמירת הקבצים לא כלולים.</p>
      </Card>
      <CostByKind costs={d.costs} />
      <Card title="מי עלה הכי הרבה החודש">
        {d.costs[0].top.length ? (
          <Rows rows={d.costs[0].top.map((t) => [t.name || t.email || '—', usd(t.usd)])} />
        ) : <p className="text-sm text-muted">אין עדיין עלויות החודש</p>}
      </Card>
      <Card title="התראה על הוצאה">
        <p className="text-sm text-muted mb-2">כשההוצאה החודשית על AI עוברת את הסכום הזה – תופיע התראה במסך הסקירה.</p>
        <div className="flex gap-2">
          <input type="number" min="0" inputMode="decimal" value={alert} onChange={(e) => { setAlert(e.target.value); setSaved(false); }} placeholder="למשל 50" className="flex-1 rounded-xl border border-line bg-page px-3 py-2" dir="ltr" />
          <button onClick={save} className="rounded-xl bg-brand text-white font-bold px-4">{saved ? 'נשמר ✓' : 'שמירה'}</button>
        </div>
      </Card>
      <Card title="הכנסות"><p className="text-sm text-muted">יופיעו כאן כשנחבר תשלומים באפליקציה.</p></Card>
    </div>
  );
}

// כמה עלתה כל סוג פעולה (מהיקרה לזולה): פעמים, סך הכול וממוצע לפעולה. נמדד מאז שהפירוט נוסף
const KINDS = {
  'recipe-video': 'מתכון מסרטון / רשת חברתית', 'recipe-link': 'מתכון מאתר', 'recipe-photo': 'מתכון מצילום', 'recipe-text': 'מתכון מווטסאפ / טקסט',
  search: 'חיפוש מתכון ברשת', ideas: 'מה לבשל ממה שיש', stores: 'איפה הכי זול', 'pantry-scan': 'סריקת מקרר / מזווה',
  shopping: 'סידור רשימת קניות', substitute: 'תחליף למצרך', nutrition: 'ערכים תזונתיים', moderation: 'בדיקה לפני פרסום בקהילה', categories: 'שיבוץ בקטגוריות', other: 'אחר (לפני שהתחלנו למדוד)',
};
function CostByKind({ costs }) {
  const [m, setM] = useState(0);
  const rows = costs[m]?.byKind || [];
  return (
    <Card title="לפי סוג פעולה">
      <div className="flex gap-2 mb-2">
        {costs.map((c, n) => (
          <button key={c.month} onClick={() => setM(n)} className={`px-3 py-1 rounded-full text-sm border ${m === n ? 'bg-ink text-card border-ink' : 'bg-card border-line'}`}>{c.month}</button>
        ))}
      </div>
      {!rows.length ? <p className="text-sm text-muted">אין עדיין נתונים לחודש הזה (הפירוט נמדד מעכשיו)</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-muted text-xs text-right"><th className="font-normal py-1">פעולה</th><th className="font-normal">פעמים</th><th className="font-normal">ממוצע</th><th className="font-normal">סך הכול</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((k) => (
                <tr key={k.kind}>
                  <td className="py-1.5">{KINDS[k.kind] || k.kind}</td>
                  <td dir="ltr" className="text-right">{k.ops}</td>
                  <td dir="ltr" className="text-right">{k.avg === null ? '—' : `$${k.avg.toFixed(3)}`}</td>
                  <td dir="ltr" className="text-right font-bold">{usd(k.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted mt-2">מתכון מקישור שמישהו כבר הוסיף מגיע מהמטמון – בחינם, ולא נספר כאן.</p>
    </Card>
  );
}

const REASON = { 'not-recipe': 'לא מתכון', offensive: 'פוגעני', personal: 'פרטים אישיים', copied: 'הועתק', other: 'אחר' };

// מתכון בקהילה שדווח, או שבדיקת ה-AI לא הייתה בטוחה לגביו: צפייה, אישור, הסרה או חסימת המפרסם
function Report({ r, session, reload }) {
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const act = async (action) => {
    if (action === 'block' && !window.confirm(`לחסום את "${r.author}" מפרסום בקהילה? כל מה שפרסם/ה יורד.`)) return;
    setBusy(true);
    try {
      if (action === 'view') setRecipe((await api(session, 'POST', `/admin/reports/${r.key}`, { action })).recipe);
      else {
        await api(session, 'POST', `/admin/reports/${r.key}`, { action });
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{r.title}</div>
          <div className="text-xs text-muted">{r.personal ? `פורסם ע"י ${r.author}` : r.credit}</div>
        </div>
        {r.hidden && <span className="text-xs rounded-full px-2 py-0.5 bg-red-500/10 text-red-700 dark:text-red-300 shrink-0">מוסתר</span>}
      </div>
      <div className="mt-1 text-sm">
        {r.reports > 0 && <div>{r.reports} דיווחים: {r.reasons.map((x) => REASON[x] || x).join(', ')}</div>}
        {r.flagged && <div className="text-amber-700 dark:text-amber-300">בדיקה אוטומטית: {r.flagReason || 'לא בטוח'}</div>}
      </div>
      {recipe && (
        <div className="mt-2 rounded-lg bg-page p-2 text-sm max-h-60 overflow-auto">
          {recipe.image && <img src={recipe.image} alt="" className="w-full max-h-40 object-cover rounded mb-2" />}
          {(recipe.ingredients || []).flatMap((s) => s.items).map((i, k) => <div key={k}>• {i}</div>)}
          {(recipe.steps || []).flatMap((s) => s.items).map((i, k) => <div key={`s${k}`}>{k + 1}. {i}</div>)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {!recipe && <button disabled={busy} onClick={() => act('view')} className="text-sm rounded-full border border-line px-3 py-1">צפייה</button>}
        <button disabled={busy} onClick={() => act('approve')} className="text-sm rounded-full bg-emerald-600 text-white px-3 py-1">אישור</button>
        <button disabled={busy} onClick={() => act('remove')} className="text-sm rounded-full border border-line px-3 py-1">הסרה</button>
        {r.personal && r.authorId !== 'owner' && <button disabled={busy} onClick={() => act('block')} className="text-sm rounded-full bg-red-600 text-white px-3 py-1">חסימת המפרסם</button>}
      </div>
    </div>
  );
}

// תגובה / "הכנתי!" בקהילה שדווחה או שבדיקת ה-AI לא הייתה בטוחה לגביה
const TALK_REASON = { offensive: 'פוגעני', personal: 'פרטים אישיים', spam: 'ספאם', other: 'אחר' };
function TalkReport({ t, session, reload }) {
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    if (action === 'block' && !window.confirm(`לחסום את "${t.author}" מכתיבה ופרסום בקהילה? כל מה שכתב/ה יורד.`)) return;
    setBusy(true);
    try {
      await api(session, 'POST', `/admin/talk/${t.key}/${t.id}`, { action });
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted">{t.recipe} · {t.author}{t.kind === 'made' ? ' · 📸 הכנתי!' : ''}</div>
          {t.text && <div className="mt-1 whitespace-pre-line break-words" dir="auto">{t.text}</div>}
          {t.image && <img src={t.image} alt="" className="mt-2 w-32 h-32 object-cover rounded-lg" />}
        </div>
        {t.hidden && <span className="text-xs rounded-full px-2 py-0.5 bg-red-500/10 text-red-700 dark:text-red-300 shrink-0">מוסתר</span>}
      </div>
      <div className="mt-1 text-sm">
        {t.reports > 0 && <div>{t.reports} דיווחים: {t.reasons.map((x) => TALK_REASON[x] || x).join(', ')}</div>}
        {t.flagged && <div className="text-amber-700 dark:text-amber-300">בדיקה אוטומטית: {t.flagReason || 'לא בטוח'}</div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => act('approve')} className="text-sm rounded-full bg-emerald-600 text-white px-3 py-1">אישור</button>
        <button disabled={busy} onClick={() => act('remove')} className="text-sm rounded-full border border-line px-3 py-1">הסרה</button>
        {t.authorId !== 'owner' && <button disabled={busy} onClick={() => act('block')} className="text-sm rounded-full bg-red-600 text-white px-3 py-1">חסימת הכותב</button>}
      </div>
    </div>
  );
}

const STATUS_STYLE = { new: 'bg-red-500/10 text-red-700 dark:text-red-300', working: 'bg-amber-500/15 text-amber-800 dark:text-amber-300', fixed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };

function Issues({ list, noRecipe = [], session, reload }) {
  const [filter, setFilter] = useState('open');
  const shown = filter === 'none' ? [] : list.filter((i) => (filter === 'open' ? i.status !== 'fixed' : i.status === 'fixed'));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[['open', `פתוחות (${list.filter((i) => i.status !== 'fixed').length})`], ['fixed', `תוקנו (${list.filter((i) => i.status === 'fixed').length})`], ['none', `לא נמצא מתכון (${noRecipe.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-full text-sm border ${filter === id ? 'bg-ink text-card border-ink' : 'bg-card border-line'}`}>{label}</button>
        ))}
      </div>
      {filter === 'none' && <NoRecipe list={noRecipe} />}
      {filter !== 'none' && !shown.length && <Card><p className="text-sm text-muted">{filter === 'open' ? 'אין תקלות פתוחות 🎉' : 'עוד לא סומנו תקלות כמתוקנות'}</p></Card>}
      {shown.map((i) => <Issue key={i.sig} i={i} session={session} reload={reload} />)}
    </div>
  );
}

// קישורים שהסוכן קרא ולא מצא בהם מתכון (סרטון עם תגיות בלבד, שיחה ב-Gemini...) – לא תקלה, בלי התראות
function NoRecipe({ list }) {
  return (
    <>
      <Card><p className="text-sm text-muted">כאן מופיעים קישורים שבהם לא נמצא מתכון. זו לא תקלה, ולכן אין עליהם התראות. המשתמש קיבל הסבר מה לעשות.</p></Card>
      {list.map((n, k) => (
        <Card key={k}>
          <div className="text-sm break-words" dir="auto">{n.message}</div>
          <div className="text-xs text-muted mt-1">
            {String(n.group || '').replace(/^NoRecipeError:/, '') || 'טקסט / צילום'} · {ago(n.at)}{n.count > 1 ? ` · ${n.count} פעמים` : ''}
            {n.user && <> · <span dir="ltr">{n.user}</span></>}
          </div>
        </Card>
      ))}
    </>
  );
}

function Issue({ i, session, reload }) {
  const [note, setNote] = useState(i.note || '');
  const [busy, setBusy] = useState(false);
  const update = async (patch) => {
    setBusy(true);
    try {
      await api(session, 'POST', `/admin/issues/${i.sig}`, patch);
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <div className="flex items-start gap-2">
        <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${STATUS_STYLE[i.status]}`}>{ISSUE_STATUS[i.status]}{i.reopened ? ' · חזרה' : ''}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium break-words" dir="auto">{i.message}</div>
          <div className="text-xs text-muted mt-1">
            {i.list === 'client' ? 'באפליקציה' : 'בשרת'} · {i.where} · {i.count} פעמים · אחרונה {ago(i.lastAt)}
            {i.users?.length > 0 && <> · <span dir="ltr">{i.users.join(', ')}</span></>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(ISSUE_STATUS).filter(([k]) => k !== i.status).map(([k, label]) => (
          <button key={k} disabled={busy} onClick={() => update({ status: k })} className="text-sm rounded-full border border-line px-3 py-1 hover:bg-page disabled:opacity-50">סימון: {label}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה (מה צריך לתקן / מה תוקן)" className="flex-1 min-w-0 rounded-xl border border-line bg-page px-3 py-1.5 text-sm" />
        {note !== (i.note || '') && <button disabled={busy} onClick={() => update({ note })} className="text-sm rounded-xl bg-brand text-white px-3">שמירה</button>}
      </div>
      {i.status !== 'fixed' && <ClaudeFix i={i} session={session} reload={reload} />}
    </Card>
  );
}

// "שלח ל-Claude לטיפול": התקלה נפתחת ב-GitHub (בלי פרטי משתמשים), Claude חוקר ומכין תיקון,
// וכאן רואים את ההסבר שלו ומאשרים ("לאשר ולהעלות" ממזג והשינוי עולה לאוויר) או דוחים
const FIX_STATUS = {
  received: 'נשלח – Claude עוד מעט מתחיל', working: 'Claude עובד על זה… (כמה דקות)', ready: 'יש תיקון מוכן לאישור',
  question: 'ל-Claude יש שאלה', nobug: 'Claude בדק – זה לא באג בקוד', failed: 'הטיפול נכשל', done: 'התיקון עלה ✓', rejected: 'נדחה', closed: 'נסגר',
};
// צילומי מסך לצרף ל-Claude (עד 3): תמונות קטנות עם איקס, וכפתור הוספה מהגלריה
function Shots({ shots, setShots, setError }) {
  const add = async (files) => {
    setError('');
    try {
      const next = [...shots];
      for (const f of [...files].slice(0, 3 - shots.length)) next.push(await shrinkImage(f));
      setShots(next);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {shots.map((src, n) => (
        <div key={n} className="relative">
          <img src={src} alt={`צילום מסך ${n + 1}`} className="w-14 h-14 rounded-lg object-cover border border-line" />
          <button type="button" onClick={() => setShots(shots.filter((_, k) => k !== n))} className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-ink text-card flex items-center justify-center" aria-label="הסרת הצילום"><X size={12} /></button>
        </div>
      ))}
      {shots.length < 3 && (
        <label className="text-sm rounded-full border border-line px-3 py-1 inline-flex items-center gap-1 cursor-pointer hover:bg-page">
          <ImagePlus size={15} /> {shots.length ? 'עוד צילום' : 'צירוף צילום מסך'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}

function ClaudeFix({ i, session, reload }) {
  const [fix, setFix] = useState(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!i.fix) return;
    try {
      setFix(await api(session, 'GET', `/admin/fix/${i.fix}`));
    } catch (e) {
      setError(e.message);
    }
  }, [i.fix, session]);
  useEffect(() => {
    load();
  }, [load]);
  // בזמן ש-Claude עובד – בודקים שוב כל חצי דקה
  useEffect(() => {
    if (!fix || !['received', 'working'].includes(fix.status)) return undefined;
    const t = setInterval(load, 30000);
    return () => {
      clearInterval(t);
    };
  }, [fix, load]);
  const run = async (method, path, body) => {
    setBusy(true);
    setError('');
    try {
      await api(session, method, path, body);
      setText('');
      setShots([]);
      setOpen(false);
      await reload();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const btn = 'text-sm rounded-full px-3 py-1 disabled:opacity-50';
  if (!i.fix) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        {!open ? (
          <button onClick={() => setOpen(true)} className={`${btn} bg-brand text-white inline-flex items-center gap-1`}><Bot size={15} /> שלח ל-Claude לטיפול</button>
        ) : (
          <div className="space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="פרטים נוספים ל-Claude (לא חובה): מתי זה קורה, מה ציפית שיקרה" className="w-full rounded-xl border border-line bg-page px-3 py-2 text-sm" />
            <Shots shots={shots} setShots={setShots} setError={setError} />
            <p className="text-xs text-muted">Claude יחקור, יתקן ויריץ בדיקות (בערך 5–15 דקות). שום דבר לא עולה לאוויר בלי האישור שלך. פרטי המשתמשים לא נשלחים, וצילומי המסך נשמרים רק בשרת שלך (30 יום).</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => run('POST', `/admin/issues/${i.sig}/fix`, { note: text, images: shots })} className={`${btn} bg-brand text-white inline-flex items-center gap-1`}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />} שליחה
              </button>
              <button onClick={() => setOpen(false)} className={`${btn} border border-line`}>ביטול</button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
  const s = fix?.status;
  return (
    <div className="mt-3 border-t border-line pt-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {!fix || ['received', 'working'].includes(s) ? <Loader2 size={15} className="animate-spin text-brand" /> : <Bot size={15} className="text-brand" />}
        {fix ? FIX_STATUS[s] || s : 'טוען…'}
      </div>
      {fix?.message && <p className="text-sm whitespace-pre-line rounded-xl bg-page p-3 break-words" dir="auto">{fix.message.replace(/\nhttps:\/\/github\.com\S+/g, '')}</p>}
      {s && !['received', 'working', 'done', 'rejected', 'closed'].includes(s) && (
        <div className="flex flex-wrap gap-2">
          {s === 'ready' && (
            <button disabled={busy} onClick={() => run('POST', `/admin/fix/${i.fix}/approve`)} className={`${btn} bg-emerald-600 text-white inline-flex items-center gap-1`}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} לאשר ולהעלות
            </button>
          )}
          {['failed', 'question', 'ready', 'nobug'].includes(s) && <button disabled={busy} onClick={() => run('POST', `/admin/fix/${i.fix}/retry`)} className={`${btn} border border-line`}>לנסות שוב</button>}
          <button disabled={busy} onClick={() => setOpen((o) => !o)} className={`${btn} border border-line`}>{s === 'question' ? 'לענות' : 'לכתוב ל-Claude'}</button>
          <button disabled={busy} onClick={() => run('POST', `/admin/fix/${i.fix}/reject`)} className={`${btn} border border-line text-muted`}>{s === 'nobug' ? 'סגירה' : 'לדחות'}</button>
        </div>
      )}
      {open && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="התשובה שלך ל-Claude" className="flex-1 min-w-0 rounded-xl border border-line bg-page px-3 py-1.5 text-sm" />
            <button disabled={busy || (!text.trim() && !shots.length)} onClick={() => run('POST', `/admin/fix/${i.fix}/reply`, { text, images: shots })} className="text-sm rounded-xl bg-brand text-white px-3 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : 'שליחה'}
            </button>
          </div>
          <Shots shots={shots} setShots={setShots} setError={setError} />
        </div>
      )}
      {s === 'done' && <p className="text-xs text-muted">השינוי עולה לאוויר בדקות הקרובות. אחר כך לסגור ולפתוח את האפליקציה.</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Security({ d }) {
  const days = d.security.days.slice(0, 14);
  const total = (k) => days.reduce((n, x) => n + (x[k] || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {['ownerFail', 'loginFail', 'rateLimited', 'ownerLogin'].map((k) => <Stat key={k} label={SECURITY[k]} value={total(k)} sub="ב-14 ימים" />)}
      </div>
      <Card title="גיבוי לילי">
        {d.backups ? (
          <Rows rows={[['גיבוי אחרון', d.backups.last || 'אין עדיין'], ['גיבויים שמורים (30 יום)', d.backups.count], ['האחרון הושלם', d.backups.ok ? 'כן ✓' : 'לא']]} />
        ) : <p className="text-sm text-muted">הגיבוי לא מוגדר</p>}
      </Card>
      <Card title="אירועים אחרונים">
        {!d.security.events.length && <p className="text-sm text-muted">אין אירועים</p>}
        <ul className="divide-y divide-line text-sm">
          {d.security.events.slice(0, 40).map((e, idx) => (
            <li key={idx} className="py-2 flex gap-2">
              <span className="flex-1">{SECURITY[e.type] || e.type}{e.detail && <span className="text-muted"> · {e.detail}</span>}</span>
              <span className="text-xs text-muted shrink-0">{ago(e.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Content({ d, session, reload }) {
  const c = d.community;
  return (
    <div className="space-y-4">
      <Card title={`ממתינים לבדיקה (${d.reportList.length})`}>
        {!d.reportList.length && <p className="text-sm text-muted">אין דיווחים או מתכונים שמחכים לבדיקה 🎉</p>}
        <div className="space-y-3">
          {d.reportList.map((r) => <Report key={r.key} r={r} session={session} reload={reload} />)}
        </div>
      </Card>
      <Card title={`תגובות שמחכות לבדיקה (${(d.talkList || []).length})`}>
        {!(d.talkList || []).length && <p className="text-sm text-muted">אין תגובות שמחכות לבדיקה 🎉</p>}
        <div className="space-y-3">
          {(d.talkList || []).map((t) => <TalkReport key={t.id} t={t} session={session} reload={reload} />)}
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label="מתכונים בקהילה" value={c.recipes} />
        <Stat label="שמירות" value={c.saves} />
        <Stat label="דירוגים" value={c.ratings} />
        <Stat label="מתכונים משוערים" value={c.guessed} sub="מקור בלי מתכון כתוב" />
      </div>
      <Card title="הכי פופולריים">
        <ul className="divide-y divide-line">
          {c.top.map((r) => (
            <li key={r.title} className="py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="truncate">{r.title}</div>
                {r.credit && <div className="text-xs text-muted truncate">{r.credit}</div>}
              </div>
              {r.rating && <span className="text-sm inline-flex items-center gap-0.5"><Star size={13} className="text-amber-500" fill="currentColor" />{r.rating}</span>}
              <span className="text-sm text-muted">{r.saves} שמירות</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
