import { useEffect, useRef, useState } from 'react';
import GuitarStage from '../components/GuitarStage';
import LessonLayout from '../components/LessonLayout';
import { LESSON2, AM_CHORD, pick } from '../lib/lessons';
import { playTick, unlockAudio } from '../lib/audio';
import { rms } from '../lib/pitch';
import { startMic, micErrorMessage } from '../lib/mic';
import { markLessonDone } from '../lib/storage';
import { IconPlay, IconStop, IconMic } from '../components/Icons';

const AM_SPEC = { fingers: AM_CHORD.fingers.map(({ finger, string, fret }) => ({ finger, string, fret })) };
const PATTERN = [
  { dir: 'd', label: 'למטה' },
  { dir: 'd', label: 'למטה' },
  { dir: 'u', label: 'למעלה' },
  { dir: 'd', label: 'למטה' },
];

export default function Lesson2({ type, teacher }) {
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState(null);
  const step = LESSON2[idx];
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(70);
  const [beat, setBeat] = useState(-1);
  const stageRef = useRef(null);
  stageRef.current = stage;

  useEffect(() => {
    if (!stage) return;
    stage.setCamera(step.camera);
    stage.setFocus({ parts: [], labels: [] });
    stage.showBadges(false);
    stage.setLeftHand(step.leftHand === 'am' ? AM_SPEC : null);
    stage.setRightHand('play');
    if (step.pose === 'greet') stage.wave(2.6);
  }, [stage, idx, type]);

  useEffect(() => {
    if (step.id === 'turn') markLessonDone(2);
  }, [idx]);

  // המקצב: כל פעימה = פריטה אחת
  useEffect(() => {
    if (!running || step.tool !== 'rhythm') {
      setBeat(-1);
      return;
    }
    let i = 0;
    const ms = 60000 / bpm;
    const tick = () => {
      const p = PATTERN[i % 4];
      setBeat(i % 4);
      playTick(i % 4 === 0);
      if (stageRef.current) stageRef.current.strum(p.dir, p.dir === 'd' ? AM_CHORD.strum : [3, 2, 1], Math.min(260, ms * 0.7));
      i++;
    };
    tick();
    const h = setInterval(tick, ms);
    return () => {
      clearInterval(h);
    };
  }, [running, bpm, idx]);

  useEffect(() => {
    setRunning(false);
  }, [idx]);

  let tools = null;
  if (step.tool === 'chord') tools = <ChordInfo />;
  else if (step.tool === 'playChord') {
    tools = (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() => {
            unlockAudio();
            if (stage) stage.strum('d', AM_CHORD.strum, 300);
          }}
        >
          <IconPlay width={16} height={16} /> נגן את האקורד
        </button>
        <p className="m-0 text-sm text-muted">הצליל נוצר בדפדפן, כמו מיתרים אמיתיים שנפרטים: לה, מי, לה, דו ומי.</p>
      </div>
    );
  } else if (step.tool === 'rhythm') {
    tools = (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          {PATTERN.map((p, n) => (
            <div key={n} className={`grid justify-items-center gap-0.5 rounded-xl border-[1.5px] py-2 text-center transition-colors ${beat === n ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-card text-muted'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {p.dir === 'd' ? <path d="M12 4v15M6 13l6 6 6-6" /> : <path d="M12 20V5M6 11l6-6 6 6" />}
              </svg>
              <small className="text-xs">{p.label}</small>
              <b className="font-display text-xs">{n + 1}</b>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-3">
          <span className="whitespace-nowrap font-semibold">קצב</span>
          <input type="range" min="50" max="100" step="1" value={bpm} onChange={(e) => setBpm(+e.target.value)} className="h-7 min-w-0 flex-1 accent-[var(--color-accent)]" />
          <output className="min-w-[6.5em] text-start font-bold tabular-nums">{bpm} פעמים בדקה</output>
        </label>
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() => {
            unlockAudio();
            setRunning((r) => !r);
          }}
        >
          {running ? <IconStop width={16} height={16} /> : <IconPlay width={16} height={16} />}
          {running ? 'עצור' : 'התחילו לנגן'}
        </button>
      </div>
    );
  } else if (step.tool === 'mic') {
    tools = <Listen />;
  }

  return (
    <LessonLayout
      steps={LESSON2}
      idx={idx}
      setIdx={setIdx}
      title={pick(step.title, type)}
      say={pick(step.say, type)}
      tools={tools}
      lastLabel="לרשימת השיעורים"
      onFinish={() => {
        window.location.hash = '#/';
      }}
      stageNode={<GuitarStage type={type} teacher={teacher} className="min-h-0 flex-1" onStage={setStage} />}
    />
  );
}

// דיאגרמת אקורד + מקרא האצבעות
function ChordInfo() {
  return (
    <div className="flex items-stretch gap-3">
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0 text-sm">
        {AM_CHORD.fingers.map((f) => (
          <li key={f.finger} className="flex items-center gap-2 rounded-lg bg-soft px-2 py-1">
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent font-display text-xs font-bold text-accent-ink">{f.finger}</span>
            <span>{f.label} · מיתר {f.string} · שריג {f.fret}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 px-2 py-1">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-bad font-display text-xs font-bold text-white">X</span>
          <span>מיתר 6 · לא מנגנים</span>
        </li>
        <li className="flex items-center gap-2 px-2 py-1">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-ink font-display text-xs font-bold">O</span>
          <span>מיתרים 5 ו-1 · פתוחים</span>
        </li>
      </ul>
      <div className="w-28 flex-none rounded-xl border border-line bg-page p-1.5 text-center text-ink lg:w-32">
        <b className="block font-display">Am</b>
        <svg viewBox="0 0 120 142" role="img" aria-label="דיאגרמת אקורד Am: אצבע 1 במיתר 2 שריג 1, אצבע 2 במיתר 4 שריג 2, אצבע 3 במיתר 3 שריג 2" className="block h-auto w-full" style={{ direction: 'ltr' }}>
          <g stroke="currentColor" strokeWidth="1.4" fill="none">
            <line x1="20" y1="30" x2="100" y2="30" strokeWidth="4" />
            {[54, 78, 102, 126].map((y) => <line key={y} x1="20" y1={y} x2="100" y2={y} />)}
            {[20, 36, 52, 68, 84, 100].map((x) => <line key={x} x1={x} y1="30" x2={x} y2="126" />)}
          </g>
          <g fontFamily="Rubik, sans-serif" fontWeight="700" textAnchor="middle">
            <text x="20" y="22" fontSize="13" fill="var(--color-bad)">×</text>
            <circle cx="36" cy="17" r="4.500" fill="none" stroke="currentColor" strokeWidth="1.600" />
            <circle cx="100" cy="17" r="4.500" fill="none" stroke="currentColor" strokeWidth="1.600" />
            {[[84, 42, 1], [52, 66, 2], [68, 66, 3]].map(([x, y, n]) => (
              <g key={n}>
                <circle cx={x} cy={y} r="8" fill="var(--color-accent)" />
                <text x={x} y={y + 4.5} fontSize="11" fill="var(--color-accent-ink)">{n}</text>
              </g>
            ))}
            <g fontSize="9" fontWeight="600" fill="var(--color-muted)">
              {[20, 36, 52, 68, 84, 100].map((x, k) => <text key={x} x={x} y="138">{6 - k}</text>)}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

// "התור שלך": מקשיבים למיקרופון ורק מזהים שיש נגינה (לא מזהים את האקורד)
function Listen() {
  const [state, setState] = useState('idle'); // idle | on | error
  const [msg, setMsg] = useState('');
  const [level, setLevel] = useState(0);
  const [hits, setHits] = useState(0);
  const micRef = useRef(null);
  const armed = useRef(true);

  useEffect(() => {
    return () => {
      if (micRef.current) micRef.current.stop();
    };
  }, []);

  const start = async () => {
    unlockAudio();
    try {
      const m = await startMic((buf) => {
        const r = rms(buf);
        setLevel(Math.min(1, r * 8));
        // פריטה חדשה = קפיצה בעוצמה אחרי שקט
        if (r < 0.015) armed.current = true;
        else if (r > 0.04 && armed.current) {
          armed.current = false;
          setHits((h) => h + 1);
        }
      });
      micRef.current = m;
      setState('on');
    } catch (e) {
      setMsg(micErrorMessage(e));
      setState('error');
    }
  };
  const stop = () => {
    if (micRef.current) micRef.current.stop();
    micRef.current = null;
    setState('idle');
    setLevel(0);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {state !== 'on' ? (
        <button type="button" className="btn btn-primary self-start" onClick={start}>
          <IconMic /> הפעילו מיקרופון
        </button>
      ) : (
        <button type="button" className="btn self-start" onClick={stop}>
          <IconStop width={16} height={16} /> עצרו הקשבה
        </button>
      )}
      {state === 'error' && <div className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad" role="alert">{msg}</div>}
      {state === 'on' && (
        <>
          <div className="h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <div className={`rounded-xl px-3 py-2 text-[15px] font-semibold ${hits ? 'bg-good-soft text-good' : 'bg-soft'}`} role="status">
            {hits ? `שמעתי נגינה! זיהיתי ${hits} פריטות. כל הכבוד על ההתחלה.` : 'מחכה לנגינה... פרטו את האקורד.'}
          </div>
        </>
      )}
      <p className="m-0 rounded-xl border border-dashed border-line px-3 py-2 text-[13px] leading-snug text-muted">
        חשוב לדעת: אני שומע שיש נגינה, אבל לא בודק אם האקורד נכון. בדקו בעצמכם: פרטו כל מיתר לאט. אם משהו זמזם, הזיזו את האצבע קרוב יותר לשריג ולחצו חזק יותר.
      </p>
    </div>
  );
}
