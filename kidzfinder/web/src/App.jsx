import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, MapPin, BellRing, PhoneCall, ShieldQuestion, Navigation, Route, Plus, X } from 'lucide-react';
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
  const [adding, setAdding] = useState(false);   // מצב "הוספת מקום" (לוחצים על המפה)
  const [pending, setPending] = useState(null);   // נקודה שנבחרה על המפה למקום חדש
  const [routeOf, setRouteOf] = useState(null);   // הילד שמוצג לו מסלול היום
  const [track, setTrack] = useState(null);       // נקודות המסלול
  const [codeModal, setCodeModal] = useState(null); // קוד לחיבור ילד נוסף
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

  // מסלול היום: הדלקה/כיבוי לילד נבחר
  async function toggleRoute(childId) {
    if (routeOf === childId) { setRouteOf(null); setTrack(null); return; }
    setRouteOf(childId);
    if (demo) { setTrack(DEMO_PATH.map(([lat, lng]) => ({ lat, lng }))); return; }
    try {
      const r = await api.track(parent.familyId, parent.token, childId);
      setTrack(r.track || []);
      if (!r.track || r.track.length < 2) showToast('אין עדיין מספיק נקודות למסלול היום');
    } catch { showToast('לא הצלחתי לטעון את המסלול'); }
  }

  // שמירת מקום חדש (אחרי בחירת נקודה על המפה)
  async function savePlace(name, radius) {
    const place = { name: name || 'מקום', lat: pending.lat, lng: pending.lng, radius };
    setAdding(false); setPending(null);
    if (demo) {
      setState((s) => ({ ...s, places: [...s.places, { ...place, id: 'p' + Date.now() }] }));
      return;
    }
    try {
      await api.addPlace(parent.familyId, parent.token, place);
      showToast('המקום נשמר — תקבל התראה כשהילד מגיע או יוצא');
    } catch { showToast('לא הצלחתי לשמור את המקום'); }
  }

  async function deletePlace(id) {
    if (demo) { setState((s) => ({ ...s, places: s.places.filter((p) => p.id !== id) })); return; }
    try { await api.delPlace(parent.familyId, parent.token, id); } catch {}
  }

  // יצירת קוד חיבור לילד נוסף
  async function addChild() {
    if (demo) { setCodeModal('123456'); return; }
    try { const r = await api.pairCode(parent.familyId, parent.token); setCodeModal(r.code); }
    catch { showToast('לא הצלחתי לייצר קוד'); }
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-extrabold text-accent">🧭 Kidzfinder{demo && <span className="text-xs font-normal text-warn"> · הדגמה</span>}</h1>
        <div className="flex items-center gap-1">
          <button onClick={addChild} className="flex items-center gap-1 bg-soft text-accent-ink rounded-lg px-2.5 py-1.5 text-sm font-bold" aria-label="הוספת ילד">
            <Plus className="w-4 h-4" />ילד
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-soft" aria-label="מצב לילה">
            <Moon className="w-5 h-5 hidden dark:block" /><Sun className="w-5 h-5 dark:hidden" />
          </button>
          <button onClick={onExit} className="text-sm text-muted px-2">{demo ? 'יציאה' : 'נתק'}</button>
        </div>
      </header>

      {/* הודעה במצב הוספת מקום */}
      {adding && !pending && (
        <div className="mx-4 mb-2 bg-accent text-white rounded-xl px-4 py-2 text-sm text-center font-medium">
          לחצו על המפה במקום שתרצו (בית, בית ספר…)
          <button onClick={() => setAdding(false)} className="underline mr-2">ביטול</button>
        </div>
      )}

      {/* טופס שמירת מקום חדש */}
      {pending && <PlaceForm onSave={savePlace} onCancel={() => { setPending(null); setAdding(false); }} />}

      {/* כרטיס מפה נפרד לכל ילד */}
      <div className="px-4 pt-1 pb-2 flex flex-col gap-4">
        {state.children.length === 0 && (
          <div className="bg-card border border-line rounded-2xl p-5 text-center text-muted">
            עדיין לא חוברו ילדים. לחצו "+ ילד" למעלה כדי לקבל קוד, והקלידו אותו באפליקציה של הילד.
          </div>
        )}
        {state.children.map((c) => (
          <ChildMapCard
            key={c.id}
            child={c}
            places={state.places}
            adding={adding}
            onMapClick={(pt) => setPending(pt)}
            track={routeOf === c.id ? track : null}
            checkin={(demo ? demoCheckin.current : state.checkins || {})[c.id]}
            onCommand={(a) => doCommand(c.id, a)}
            routeOn={routeOf === c.id}
            onToggleRoute={() => toggleRoute(c.id)}
          />
        ))}
      </div>

      {/* מקומות (גדרות): התראה כשהילד מגיע או יוצא */}
      <Places places={state.places} adding={adding} onAdd={() => { setAdding(true); setPending(null); }} onDelete={deletePlace} />

      {/* התראות */}
      <Alerts alerts={state.alerts} />

      {/* קוד לחיבור ילד נוסף */}
      {codeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-6" onClick={() => setCodeModal(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-2">📲</div>
            <p className="text-muted text-sm">הקוד לחיבור הטלפון של הילד:</p>
            <div className="text-4xl font-extrabold tracking-widest num my-3">{codeModal}</div>
            <p className="text-xs text-muted">מתקינים את אפליקציית Kidzfinder בטלפון של הילד ומקלידים את הקוד. תקף 10 דקות.</p>
            <button onClick={() => setCodeModal(null)} className="mt-4 w-full bg-accent text-white rounded-xl py-2.5 font-bold">סגור</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 inset-x-0 flex justify-center z-[1000] px-4">
          <div className="bg-ink text-page rounded-full px-5 py-2.5 text-sm font-medium shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

// כמה זמן עבר מאז המיקום האחרון — לתווית על המפה
function lastSeenText(live) {
  if (!live) return 'אין מיקום עדיין';
  const m = Math.round((Date.now() - live.ts) / 60000);
  if (m < 1) return 'כאן עכשיו';
  if (m < 60) return `היה כאן לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `היה כאן לפני ${h} שע׳`;
  return 'היה כאן אתמול';
}

// שורת מצב לילד (סוללה, דיוק, ניתוק)
function statusLine(live) {
  if (!live) return { text: 'מחכים למיקום הראשון של הטלפון', warn: true };
  if (Date.now() - live.ts > 15 * 60 * 1000) return { text: 'לא מתקבל מיקום כרגע — ייתכן שהטלפון כבוי', warn: true };
  if (typeof live.battery === 'number' && live.battery <= 15) return { text: `הסוללה כמעט ריקה (${live.battery}%)`, warn: true };
  if (live.acc && live.acc > 120) return { text: 'ייתכן שהמיקום אינו מדויק', warn: true };
  return { text: 'מחובר ומשתף מיקום', warn: false };
}

// כרטיס מפה לילד: מפה משלו למעלה, שם ומצב למטה, ואז הכפתורים
function ChildMapCard({ child, places, adding, onMapClick, track, checkin, onCommand, routeOn, onToggleRoute }) {
  const live = child.live;
  const bat = live?.battery;
  const status = statusLine(live);
  const waiting = checkin && checkin.requested && !checkin.answered;
  const confirmed = checkin && checkin.answered;
  const mapChild = { ...child, label: lastSeenText(live) };

  return (
    <div className="bg-card border border-line rounded-2xl overflow-hidden shadow-sm">
      {/* המפה של הילד */}
      <div className="h-60 border-b border-line">
        <LiveMap children={[mapChild]} places={places} track={track} onMapClick={adding ? onMapClick : null} />
      </div>

      {/* שם ומצב */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧒</span>
            <span className="font-extrabold text-lg">{child.name}</span>
          </div>
          {typeof bat === 'number' && <span className={`text-sm ${bat <= 15 ? 'text-sos font-bold' : 'text-muted'}`}>🔋 {bat}%</span>}
        </div>
        <div className={`mt-1 text-sm flex items-center gap-1.5 ${status.warn ? 'text-sos' : 'text-ok'}`}>
          <span>{status.warn ? '⚠️' : '✓'}</span>{status.text}
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

      {/* ניווט ל-Google Maps אל המיקום של הילד */}
      <button
        onClick={() => {
          if (!live) return;
          const url = `https://www.google.com/maps/dir/?api=1&destination=${live.lat},${live.lng}`;
          window.open(url, '_blank', 'noopener');
        }}
        disabled={!live}
        className="mt-2 w-full flex items-center justify-center gap-2 bg-accent text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
      >
        <Navigation className="w-4 h-4" />
        {live ? `נווט אל ${child.name} ב-Google Maps` : 'אין עדיין מיקום לניווט'}
      </button>

      {/* מסלול היום */}
      <button
        onClick={onToggleRoute}
        className={`mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold ${routeOn ? 'bg-accent text-white' : 'bg-soft text-accent-ink'}`}
      >
        <Route className="w-4 h-4" />
        {routeOn ? 'הסתר מסלול היום' : 'הצג מסלול היום'}
      </button>
      </div>
    </div>
  );
}

// טופס שמירת מקום חדש (נפתח אחרי בחירת נקודה על המפה)
function PlaceForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(150);
  return (
    <div className="mx-4 mb-2 bg-card border border-line rounded-2xl p-4">
      <h3 className="font-bold mb-2">מקום חדש</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם המקום (בית, בית ספר…)"
        className="w-full bg-page border border-line rounded-xl px-3 py-2 mb-3"
        autoFocus
      />
      <label className="text-sm text-muted">גודל האזור: {radius} מ׳</label>
      <input type="range" min="80" max="500" step="10" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSave(name, radius)} className="flex-1 bg-accent text-white rounded-xl py-2.5 font-bold">שמירה</button>
        <button onClick={onCancel} className="px-4 bg-soft text-muted rounded-xl py-2.5">ביטול</button>
      </div>
    </div>
  );
}

// רשימת המקומות (גדרות) + הוספה/מחיקה
function Places({ places = [], adding, onAdd, onDelete }) {
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-muted">מקומות (התראה בהגעה/יציאה)</h2>
        {!adding && (
          <button onClick={onAdd} className="flex items-center gap-1 text-sm text-accent font-bold">
            <Plus className="w-4 h-4" />הוספה
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {places.length === 0 && <div className="text-sm text-muted">אין מקומות עדיין. הוסיפו בית ובית ספר כדי לקבל התראות.</div>}
        {places.map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-card border border-line rounded-xl px-3 py-2">
            <span className="text-sm font-medium">📍 {p.name} <span className="text-muted">· {p.radius || 150} מ׳</span></span>
            <button onClick={() => onDelete(p.id)} className="text-muted hover:text-sos p-1" aria-label="מחק מקום"><X className="w-4 h-4" /></button>
          </div>
        ))}
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
  // מתי היתה ההתראה, בשפה פשוטה
  const timeAgo = (ts) => {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return `לפני ${m} דק׳`;
    const h = Math.round(m / 60);
    if (h < 24) return `לפני ${h} שע׳`;
    return 'אתמול';
  };
  // רק התראות מ-24 השעות האחרונות (הישנות כבר לא רלוונטיות)
  const recent = alerts.filter((a) => !a.ts || Date.now() - a.ts < 24 * 60 * 60 * 1000);
  if (!recent.length) return null;
  return (
    <div className="px-4 pb-8">
      <h2 className="text-sm font-bold text-muted mb-2">התראות (24 שעות אחרונות)</h2>
      <div className="flex flex-col gap-1.5">
        {[...recent].reverse().slice(0, 15).map((a, i) => (
          <div key={i} className={`text-sm rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${a.type === 'sos' ? 'bg-sos/10 text-sos font-bold' : 'bg-card border border-line'}`}>
            <span>{txt(a)}</span>
            <span className="text-xs text-muted whitespace-nowrap">{timeAgo(a.ts)}</span>
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
  const pos2 = demoPosition(t + 25000); // ילד שני במקום אחר על המסלול
  return {
    name: 'משפחת הדגמה',
    children: [
      { id: 'demo', name: 'נועה', live: { ...pos, battery: bat, ts: t, placeIds: [] } },
      { id: 'demo2', name: 'איתי', live: { ...pos2, battery: 12, ts: t - 11 * 60000, placeIds: [] } },
    ],
    places: DEMO_PLACES,
    checkins,
    alerts: [
      { type: 'joined', childName: 'נועה', ts: t - 3600000 },
      { type: 'arrived', childName: 'נועה', place: 'בית ספר', ts: t - 1800000 },
    ],
  };
}
