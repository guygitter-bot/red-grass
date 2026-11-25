import { useEffect, useState } from 'react';
import { useApp } from '../context';
import Moon from '../components/Moon';
import { upcomingNight } from '../lib/night';
import { kindById } from '../lib/kinds';
import { keepAwake, chime, speak, stopSpeaking } from '../lib/night-tools';

const BREATHS = 6; // 6 נשימות של 10 שניות (4 שאיפה, 6 נשיפה)

// טקס השינה – מבוסס על ההנחיות של דירדרה ברט (1993): לעבור על השאלה, לדמיין תמונה, לחזור על הכוונה, ולהתכונן להתעוררות שקטה
export default function Ritual() {
  const { data, update } = useApp();
  const key = upcomingNight();
  const intention = data.nights[key];
  const [step, setStep] = useState(0);
  const [breath, setBreath] = useState(0);
  const [reps, setReps] = useState(0);
  const { voice, chime: useChime } = data.settings;
  const phrase = intention?.phrase || '';

  // מסך דולק כל עוד הטקס פתוח (חוץ מהמסך האחרון – שם הולכים לישון)
  useEffect(() => {
    if (step >= 5) return undefined;
    const release = keepAwake();
    return () => {
      release();
    };
  }, [step >= 5]);

  // מונה נשימות
  useEffect(() => {
    if (step !== 2) return undefined;
    const t = setInterval(() => {
      setBreath((b) => b + 1);
    }, 10000);
    return () => {
      clearInterval(t);
    };
  }, [step]);

  useEffect(() => {
    if (step === 2 && breath >= BREATHS) setStep(3);
  }, [breath, step]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  if (!intention) {
    return (
      <div className="sky min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="serif text-2xl">עוד לא נבחרה כוונה ללילה.</p>
          <a href="#/intend" className="btn btn-primary">לבחור כוונה</a>
        </div>
      </div>
    );
  }

  const next = () => {
    if (useChime) chime(0.12);
    setStep((s) => s + 1);
  };

  const k = kindById(intention.kind);
  const steps = [
    // 0 – הכנה
    <>
      <Moon size={110} phase={0.6} className="mx-auto" />
      <h1 className="serif text-3xl font-bold">טקס השינה</h1>
      <p className="opacity-80">חמש דקות, כבר במיטה. להנמיך את בהירות המסך, ולהניח מחברת או את הטלפון קרוב, כדי לרשום מיד כשמתעוררים.</p>
      <button className="btn btn-primary mt-4" onClick={next}>להתחיל</button>
    </>,
    // 1 – השאלה
    <>
      <p className="opacity-70 text-sm m-0">{k.icon} {k.name}</p>
      <p className="serif text-3xl font-bold leading-snug">{intention.text || 'הלילה – לזכור את החלום'}</p>
      <p className="opacity-80">
        {intention.kind === 'problem'
          ? 'לחשוב עליה עוד דקה: מה כבר ניסית? איפה זה נתקע? מה היה קורה אם זה היה נפתר?'
          : 'להחזיק את זה במחשבה עוד דקה: איך זה נראה, נשמע, מרגיש?'}
      </p>
      <button className="btn btn-primary mt-4" onClick={next}>הלאה – לנשימה</button>
    </>,
    // 2 – נשימה
    <>
      <div className="relative w-52 h-52 mx-auto my-4">
        <div className="breathe absolute inset-0 rounded-full bg-[#c9b8f2]/25 border border-[#c9b8f2]/50" />
      </div>
      <p className="serif text-2xl m-0">שואפים כשהעיגול גדל, נושפים כשהוא קטן</p>
      <p className="opacity-70" aria-live="polite">נשימה {Math.min(breath + 1, BREATHS)} מתוך {BREATHS}</p>
      <button className="btn mt-2 border-white/25 text-inherit" onClick={next}>לדלג</button>
    </>,
    // 3 – תמונה
    <>
      <p className="serif text-2xl font-bold">לעצום עיניים ולדמיין</p>
      <p className="serif text-3xl leading-snug">{intention.image || intention.text || 'את המקום שבו היית רוצה להתעורר בתוך החלום'}</p>
      <p className="opacity-80">פרטים קטנים: צבע, אור, מרקם, צליל. להיכנס לתוך התמונה כאילו זה כבר קורה.</p>
      <button className="btn btn-primary mt-4" onClick={next}>ראיתי – הלאה</button>
    </>,
    // 4 – חזרה על המשפט
    <>
      <p className="opacity-70 m-0">לחזור על המשפט, לאט, בלב או בלחש</p>
      <p className="serif text-3xl font-bold leading-snug">{phrase}</p>
      <button
        className="btn btn-primary mt-2"
        disabled={reps >= 3}
        onClick={() => {
          if (reps >= 3) return;
          if (voice) speak(phrase);
          setReps((r) => r + 1);
          if (reps + 1 >= 3) setTimeout(next, 1200);
        }}
      >
        אמרתי ({Math.min(reps, 3)} מתוך 3)
      </button>
    </>,
    // 5 – ההתעוררות
    <>
      <p className="serif text-2xl font-bold">ההוראה החשובה ביותר: כשמתעוררים</p>
      <ol className="text-start ps-5 grid gap-2 opacity-90 max-w-md mx-auto">
        <li>לא לזוז ולא לפתוח עיניים מיד.</li>
        <li>לשאול: מה חלמתי? מה עוד היה שם?</li>
        <li>לרשום מיד – גם באמצע הלילה, גם רק כמה מילים.</li>
      </ol>
      <button
        className="btn btn-primary mt-4"
        onClick={() => {
          update((d) => ({ ...d, nights: { ...d.nights, [key]: { ...d.nights[key], ritual: true } } }));
          next();
        }}
      >
        אפשר לישון
      </button>
    </>,
  ];

  // 6 – מסך לילה עמום
  if (step >= 6) {
    return (
      <div className="dim min-h-screen grid place-items-center p-6 text-center fade-in">
        <div>
          <p className="serif text-xl m-0">לילה טוב.</p>
          <p className="serif text-lg">{phrase}</p>
          <a href="#/" className="btn btn-sm mt-6 border-[#2a2338] text-[#6f6488]">לסגור</a>
        </div>
      </div>
    );
  }

  return (
    <div className="sky min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <a href="#/" className="btn btn-sm border-white/20 text-inherit" aria-label="יציאה מהטקס">✕</a>
        <div className="flex gap-1.5" aria-label={`שלב ${step + 1} מתוך 6`}>
          {steps.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i <= step ? 'bg-[#c9b8f2]' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
      <div key={step} className="fade-in flex-1 grid place-items-center px-6 pb-16 text-center">
        <div className="max-w-lg">{steps[step]}</div>
      </div>
    </div>
  );
}
