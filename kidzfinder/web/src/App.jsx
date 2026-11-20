import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, MapPin, BellRing, PhoneCall, ShieldQuestion, Plus, X } from 'lucide-react';
import LiveMap from './components/LiveMap';
import { toggle as toggleTheme } from './lib/theme';
import { loadParent, saveParent, clearParent } from './lib/store';
import { api } from './lib/api';
import { demoPosition, demoBattery, DEMO_PLACES } from './lib/demo';

export default function App() {
  const saved = loadParent();
  const [mode, setMode] = useState(saved ? 'real' : 'landing');

  if (mode === 'landing') return <Landing onDemo={() => setMode('demo')} onReal={() => setMode('real')} />;
  if (mode === 'demo') return <Dashboard demo onExit={() => setMode('landing')} />;
  return <Dashboard onExit={() => { clearParent(); setMode('landing'); }} />;
}

/* ---------- מסך פתיחה ---------- */
function Landing({ onDemo, onReal }) {
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState(null);
  const [name, setName] = useState('');

  async function create() {
    setCreating(true);
    try {
      const fam = await api.createFamily(name || 'המשפחה שלי', 'הורה');
      saveParent({ familyId: fam.familyId, token: fam.parentToken, name: fam.name });
      const pc = await api.pairCode(fam.familyId, fam.parentToken);
      setCode(pc.code);
    } catch {
      alert('לא הצלחתי להתחבר לשרת. נסו שוב.');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center gap-6">
      <div className="text-5xl">🧭</div>
      <div>
        <h1 className="text-3xl font-extrabold text-accent">Kidzfinder</h1>
        <p className="text-muted mt-2 max-w-xs">לראות את הילד/ה על מפה חיה — בשקיפות מלאה. הילד יודע שהמיקום משותף.</p>
      </div>

      {code ? (
        <div className="bg-card rounded-2xl border border-line p-5 w-full max-w-xs">
          <p className="text-muted text-sm">הקוד לחיבור הטלפון של הילד:</p>
          <div className="text-4xl font-extrabold tracking-widest num my-2">{code}</div>
          <p className="text-xs text-muted">מקלידים אותו באפליקציה של הילד. הקוד תקף 10 דקות.</p>
          <button onClick={() => location.reload()} className="mt-4 w-full bg-accent text-white rounded-xl py-2.5 font-bold">
            המשך למפה
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button onClick={onDemo} className="w-full bg-accent text-white rounded-xl py-3 font-bold text-lg">
            👀 ראו הדגמה חיה
          </button>
          <div className="bg-card rounded-2xl border border-line p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם המשפחה"
              className="w-full bg-page border border-line rounded-xl px-3 py-2 mb-2 text-center"
            />
            <button onClick={create} disabled={creating} className="w-full bg-soft text-accent-ink rounded-xl py-2.5 font-bold disabled:opacity-50">
              {creating ? 'יוצר…' : 'פתיחת משפחה אמיתית'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- לוח ההורה ---------- */
function Dashboard({ demo, onExit }) {
  const parent = demo ? null : loadParent();
  const [state, setState] = useState(demoState(demo, Date.now()));
  const [follow, setFollow] = useState(null);
  const [toast, setToast] = useState('');
  // בדיקות שההורה שלח (לכל ילד): { requested, answered } — במצב אמיתי מגיע מהשרת
  const demoCheckin = useRef({});

  // מצב הדגמה: שעון שמזיז את הילד כל 2 שניות
  useEffect(() => {
    if (!demo) return;
    const t = setInterval(() => setState(demoState(true, Date.now(), demoCheckin.current)), 2000);
    return () => clearInterval(t);
  }, [demo]);

  // מצב אמיתי: משיכת המצב מהשרת כל 4 שניות
  useEffect(() => {
    if (demo || !parent) return;
    let live = true;
    async function tick() {
      try {
        const s = await api.state(parent.familyId, parent.token);
        if (live) setState(s);
      } catch {}
    }
    tick();
    const t = setInterval(tick, 4000);
    return () => { live = false; clearInterval(t); };
  }, [demo]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function doCommand(childId, action) {
    const labels = { ring: 'שלחתי צלצול חזק לטלפון של הילד', call: 'מתקשר לילד…', checkin: 'שלחתי בקשה: "תגיד/י לי שאתה בסדר"' };
    showToast(labels[action]);
    if (demo) {
      if (action === 'checkin') {
        demoCheckin.current[childId] = { requested: Date.now(), answered: null };
        // הילד מגיב אחרי ~3 שניות
        setTimeout(() => {
          demoCheckin.current[childId] = { requested: Date.now() - 3000, answered: Date.now() };
          setState(demoState(true, Date.now(), demoCheckin.current));
          showToast('✓ הילד/ה אישר/ה: הכל בסדר');
        }, 3000);
      }
      return;
    }
    try {
      await api.command(parent.familyId, parent.token, childId, action);
    } catch {
      showToast('לא הצלחתי לשלוח, נסו שוב');
    }
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-extrabold text-accent">🧭 Kidzfinder{demo && <span className="text-xs font-normal text-warn"> · הדגמה</span>}</h1>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-soft" aria-label="מצב לילה">
            <Moon className="w-5 h-5 hidden dark:block" /><Sun className="w-5 h-5 dark:hidden" />
          </button>
          <button onClick={onExit} className="text-sm text-muted px-2">{demo ? 'יציאה' : 'נתק'}</button>
        </div>
      </header>

      {/* המפה החיה */}
      <div className="mx-4 rounded-2xl overflow-hidden border border-line h-[52vh] min-h-[320px] shadow-sm">
        <LiveMap children={state.children} places={state.places} follow={follow} />
      </div>

      {/* הילדים */}
      <div className="p-4 flex flex-col gap-3">
        {state.children.length === 0 && (
          <div className="bg-card border border-line rounded-2xl p-5 text-center text-muted">
            עדיין לא חוברו ילדים. פִתחו את אפליקציית הילד והקלידו את הקוד.
          </div>
        )}
        {state.children.map((c) => (
          <ChildCard
            key={c.id}
            child={c}
            checkin={(demo ? demoCheckin.current : state.checkins || {})[c.id]}
            following={follow === c.id}
            onFollow={() => setFollow(follow === c.id ? null : c.id)}
            onCommand={(a) => doCommand(c.id, a)}
          />
        ))}
      </div>

      {/* התראות */}
      <Alerts alerts={state.alerts} />

      {toast && (
        <div className="fixed bottom-5 inset-x-0 flex justify-center z-[1000] px-4">
          <div className="bg-ink text-page rounded-full px-5 py-2.5 text-sm font-medium shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, checkin, following, onFollow, onCommand }) {
  const live = child.live;
  const mins = live ? Math.round((Date.now() - live.ts) / 60000) : null;
  const seen = mins === null ? 'אין מיקום' : mins <= 0 ? 'עכשיו' : `לפני ${mins} דק׳`;
  const bat = live?.battery;
  const waiting = checkin && checkin.requested && !checkin.answered;
  const confirmed = checkin && checkin.answered;

  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🧒</div>
          <div>
            <div className="font-bold text-lg">{child.name}</div>
            <div className="text-sm text-muted flex items-center gap-2">
              <span>🕓 {seen}</span>
              {typeof bat === 'number' && <span className={bat <= 15 ? 'text-sos font-bold' : ''}>🔋 {bat}%</span>}
            </div>
          </div>
        </div>
        <button onClick={onFollow} className={`p-2 rounded-lg ${following ? 'bg-accent text-white' : 'bg-soft text-accent-ink'}`} aria-label="עקוב על המפה">
          <MapPin className="w-5 h-5" />
        </button>
      </div>

      {/* סטטוס בדיקה */}
      {waiting && <div className="mt-3 text-sm text-warn bg-soft rounded-xl px-3 py-2">⏳ ממתין לתשובה… אם לא יענה, תקבלו התראה.</div>}
      {confirmed && <div className="mt-3 text-sm text-ok bg-soft rounded-xl px-3 py-2">✓ אישר/ה שהכל בסדר</div>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => onCommand('checkin')} className="flex flex-col items-center gap-1 bg-accent text-white rounded-xl py-2.5 text-xs font-bold">
          <ShieldQuestion className="w-5 h-5" />אתה בסדר?
        </button>
        <button onClick={() => onCommand('ring')} className="flex flex-col items-center gap-1 bg-soft text-accent-ink rounded-xl py-2.5 text-xs font-bold">
          <BellRing className="w-5 h-5" />צלצול
        </button>
        <button onClick={() => onCommand('call')} className="flex flex-col items-center gap-1 bg-soft text-accent-ink rounded-xl py-2.5 text-xs font-bold">
          <PhoneCall className="w-5 h-5" />התקשרי
        </button>
      </div>
    </div>
  );
}

function Alerts({ alerts = [] }) {
  if (!alerts.length) return null;
  const txt = (a) => {
    const n = a.childName || 'הילד';
    switch (a.type) {
      case 'arrived': return `📍 ${n} הגיע/ה ל${a.place}`;
      case 'left': return `🚶 ${n} יצא/ה מ${a.place}`;
      case 'sos': return `🆘 ${n} לחץ/ה SOS!`;
      case 'low_battery': return `🔋 הסוללה של ${n} חלשה (${a.battery}%)`;
      case 'checkin_ok': return `✓ ${n} אישר/ה שהכל בסדר`;
      case 'joined': return `👋 ${n} התחבר/ה`;
      default: return '';
    }
  };
  return (
    <div className="px-4 pb-8">
      <h2 className="text-sm font-bold text-muted mb-2">התראות אחרונות</h2>
      <div className="flex flex-col gap-1.5">
        {[...alerts].reverse().slice(0, 15).map((a, i) => (
          <div key={i} className={`text-sm rounded-xl px-3 py-2 ${a.type === 'sos' ? 'bg-sos/10 text-sos font-bold' : 'bg-card border border-line'}`}>
            {txt(a)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* מצב הדגמה: בונה את אותו מבנה שהשרת מחזיר, עם ילד שזז. */
function demoState(demo, t, checkins = {}) {
  if (!demo) return { children: [], places: [], alerts: [], checkins: {} };
  const pos = demoPosition(t);
  const bat = demoBattery(t);
  return {
    name: 'משפחת הדגמה',
    children: [{ id: 'demo', name: 'נועה', live: { ...pos, battery: bat, ts: t, placeIds: [] } }],
    places: DEMO_PLACES,
    checkins,
    alerts: [
      { type: 'joined', childName: 'נועה', ts: t - 3600000 },
      { type: 'arrived', childName: 'נועה', place: 'בית ספר', ts: t - 1800000 },
    ],
  };
}
