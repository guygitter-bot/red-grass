import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import Moon from '../components/Moon';
import { nightKey } from '../lib/night';
import { safeEntry } from '../lib/store';
import { keepAwake, chime, speak, stopSpeaking, buzz } from '../lib/night-tools';

const MIN_HOLD = 20; // שחרור לפני 20 שניות = כנראה בטעות, לא הירדמות

// תנומת אדיסון: מחזיקים את הירח, וכשהיד נרפית בהירדמות – צלצול מעיר ורושמים מה עלה.
// בהשראת הניסוי של Lacaux ועמיתים (2021) וההתקן Dormio של MIT (2020, 2023).
export default function Nap() {
  const { data, update, setToast } = useApp();
  const tonight = data.nights[nightKey()];
  const [topic, setTopic] = useState(tonight?.text || '');
  const [state, setState] = useState('setup'); // setup | ready | holding | woke | short
  const [glimpses, setGlimpses] = useState([]);
  const [note, setNote] = useState('');
  const [heldFor, setHeldFor] = useState(0);
  const start = useRef(0);
  const prompt = useRef(null);
  const cycles = data.settings.napCycles;
  const { voice, chime: useChime } = data.settings;

  // המסך לא נכבה במהלך התנומה
  useEffect(() => {
    if (state === 'setup') return undefined;
    const release = keepAwake();
    return () => {
      release();
    };
  }, [state === 'setup']);

  useEffect(() => {
    return () => {
      clearTimeout(prompt.current);
      stopSpeaking();
    };
  }, []);

  const hold = (e) => {
    e.preventDefault();
    if (state !== 'ready' && state !== 'short') return;
    start.current = Date.now();
    setState('holding');
    // אחרי כמה שניות – תזכורת בקול (אם יש קול עברי במכשיר)
    clearTimeout(prompt.current);
    prompt.current = setTimeout(() => {
      if (voice && topic.trim()) speak(`לחשוב על ${topic.trim()}`);
    }, 6000);
  };

  const release = () => {
    if (state !== 'holding') return;
    clearTimeout(prompt.current);
    const secs = Math.round((Date.now() - start.current) / 1000);
    setHeldFor(secs);
    if (secs < MIN_HOLD) {
      setState('short');
      return;
    }
    if (useChime) chime(0.35);
    buzz(200);
    if (voice) setTimeout(() => speak('מה עבר לך בראש עכשיו?'), 1500);
    setState('woke');
  };

  const finish = (list) => {
    if (list.length === 0) {
      window.location.hash = '#/';
      return;
    }
    const e = safeEntry({ type: 'nap', glimpses: list, title: topic.trim() ? `תנומה: ${topic.trim()}` : 'תנומת אדיסון', at: Date.now() });
    update((d) => ({ ...d, entries: [e, ...d.entries] }));
    setToast('התנומה נשמרה ביומן');
    window.location.hash = `#/entry/${e.id}`;
  };

  if (state === 'setup') {
    return (
      <div className="sky min-h-screen">
        <div className="max-w-xl mx-auto p-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}>
          <a href="#/" className="btn btn-sm border-white/20 text-inherit" aria-label="חזרה">→</a>
          <h1 className="serif text-3xl font-bold mt-4 mb-2">תנומת אדיסון</h1>
          <p className="opacity-85">
            אדיסון, כך מספרים, נמנם עם כדור מתכת ביד – כשנרדם, הכדור נפל והעיר אותו, והוא רשם את מה שעלה. במחקר מ-2021 מצאו שמי שבילה לפחות 15 שניות בשלב ההירדמות הזה, פתר בעיה פי שלושה יותר מאחרים. כאן הטלפון הוא הכדור.
          </p>
          <ol className="ps-5 grid gap-1 opacity-90">
            <li>לשכב או לשבת בנוח, הטלפון ביד, האצבע על הירח.</li>
            <li>לחשוב על הנושא ולתת לעצמך להירדם.</li>
            <li>כשהאצבע נרפית – צלצול עדין. לרשום מה עבר בראש, ולחזור.</li>
          </ol>
          <label className="block mt-5">
            <span className="block font-bold mb-1">על מה לחשוב בזמן ההירדמות</span>
            <input className="field !bg-[#211a3a] !border-[#362d57] !text-[#efe6d2]" value={topic} placeholder="למשל: שם לעסק" onChange={(e) => setTopic(e.target.value)} />
          </label>
          <p className="text-sm opacity-70 mt-3">
            {cycles} סבבים · אפשר לשנות בהגדרות. {voice ? 'אם יש במכשיר קול בעברית, תישמע תזכורת שקטה.' : ''} כדאי להגביר מעט את הקול.
          </p>
          <button
            className="btn btn-primary w-full mt-4"
            onClick={() => {
              if (useChime) chime(0.08); // פותח את השמע בלחיצה, כדי שהצלצול יעבוד אחר כך
              setState('ready');
            }}
          >
            להתחיל
          </button>
          <p className="text-xs opacity-60 mt-4">לא להשתמש בזמן נהיגה או כשצריך להישאר ער. אם נרדמים עמוק – זה בסדר, פשוט ממשיכים לישון.</p>
        </div>
      </div>
    );
  }

  if (state === 'woke') {
    return (
      <div className="dim min-h-screen p-6 grid place-items-center">
        <div className="w-full max-w-md fade-in">
          <p className="serif text-xl text-[#b8acd6] m-0">מה עבר לך בראש?</p>
          <p className="text-sm m-0 mb-3">תמונה, מילה, תחושה – בלי לסדר. (סבב {glimpses.length + 1} מתוך {cycles})</p>
          <textarea className="field !bg-[#0e0a16] !border-[#2a2338] !text-[#cfc6e6] serif" rows={4} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="grid gap-2 mt-3">
            {glimpses.length + 1 < cycles && (
              <button
                className="btn border-[#2a2338] text-[#b8acd6]"
                onClick={() => {
                  setGlimpses((g) => (note.trim() ? [...g, note.trim()] : g));
                  setNote('');
                  setState('ready');
                }}
              >
                לשמור ולחזור לנמנם
              </button>
            )}
            <button className="btn border-[#2a2338] text-[#b8acd6]" onClick={() => finish(note.trim() ? [...glimpses, note.trim()] : glimpses)}>
              לסיים ולשמור ביומן
            </button>
          </div>
        </div>
      </div>
    );
  }

  const holding = state === 'holding';
  return (
    <div className="dim min-h-screen flex flex-col items-center justify-center p-6 select-none" style={{ touchAction: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      <p className="serif text-lg m-0 mb-6 text-center min-h-14" aria-live="polite">
        {holding ? topic || 'להירדם לאט…' : state === 'short' ? `שוחרר אחרי ${heldFor} שניות – לגעת שוב בירח` : 'לגעת בירח ולהשאיר את האצבע'}
      </p>
      <button
        className={`moon-hold rounded-full border-0 bg-transparent p-0 ${holding ? 'holding' : ''}`}
        style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
        aria-label="להחזיק את הירח"
        onPointerDown={hold}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <Moon size={240} phase={holding ? 0.2 : 0.55} glow={holding} />
      </button>
      <p className="text-sm mt-6 m-0">סבב {glimpses.length + 1} מתוך {cycles}</p>
      {!holding && (
        <button className="btn btn-sm mt-6 border-[#2a2338] text-[#6f6488]" onClick={() => finish(glimpses)}>
          לסיים
        </button>
      )}
    </div>
  );
}
