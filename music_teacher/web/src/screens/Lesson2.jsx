import { useCallback, useEffect, useRef, useState } from 'react';
import GuitarStage from '../components/GuitarStage';
import LessonLayout from '../components/LessonLayout';
import ChordOverlay from '../components/ChordOverlay';
import { LESSON2, CHORDS, pick } from '../lib/lessons';
import { FINGER_COLORS, handSpec } from '../lib/chord';
import { playTick, unlockAudio } from '../lib/audio';
import { rms } from '../lib/pitch';
import { startMic, micErrorMessage } from '../lib/mic';
import { markLessonDone } from '../lib/storage';
import { IconPlay, IconStop, IconMic } from '../components/Icons';

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
  const chord = CHORDS[step.leftHand] || null; // האקורד של השלב (ממפרט הנתונים)
  const [ghost, setGhost] = useState(false); // יד שקופה
  const [down, setDown] = useState([]); // אילו אצבעות כבר למטה (לאנימציית העיגולים בשכבת האקורד)
  const [inset, setInset] = useState(0); // כמה מהבמה תפוס בתחתית בידי שכבת האקורד
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
    // שלב האצבעות: אנימציית הנחה עם סימונים; שלבים אחרים: האקורד כבר מונח
    if (chord && step.tool === 'chord') stage.showChord(chord);
    else stage.setLeftHand(chord ? handSpec(chord) : null);
    stage.setRightHand('play');
    if (step.pose === 'greet') stage.wave(2.6);
  }, [stage, idx, type]);

  const onInset = useCallback((f) => setInset(f), []);
  useEffect(() => {
    if (stage) stage.setInset(step.tool === 'chord' ? inset : 0);
  }, [stage, inset, idx]);

  useEffect(() => {
    if (stage) stage.setGhost(ghost);
  }, [stage, ghost, type, teacher]);

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
      if (stageRef.current) stageRef.current.strum(p.dir, p.dir === 'd' ? chord.strum : [3, 2, 1], Math.min(260, ms * 0.7));
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
  if (step.tool === 'chord') tools = <ChordInfo chord={chord} />;
  else if (step.tool === 'playChord') {
    tools = (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() => {
            unlockAudio();
            if (stage) stage.strum('d', chord.strum, 300);
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
      stageNode={(
        <GuitarStage type={type} teacher={teacher} className="min-h-0 flex-1" onStage={setStage} onChordDown={setDown}>
          {step.tool === 'chord' && (
            <>
              <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                <button type="button" className="btn btn-sm shadow-md" onClick={() => stage && stage.replayChord()}>
                  <IconPlay width={14} height={14} /> הצג שוב
                </button>
                <button type="button" className={`btn btn-sm shadow-md ${ghost ? 'btn-primary' : ''}`} aria-pressed={ghost} onClick={() => setGhost((g) => !g)}>
                  יד שקופה
                </button>
              </div>
              <ChordOverlay chord={chord} down={down} onInset={onInset} />
            </>
          )}
        </GuitarStage>
      )}
    />
  );
}

// "5 ו-1"
const joinHe = (list) => list.join(' ו-');

// מקרא האצבעות. הדיאגרמה עצמה בשכבת האקורד שעל הבמה (ChordOverlay) – כאן רק הסבר במילים, באותם מספרים וצבעים
function ChordInfo({ chord }) {
  const fingers = chord.fingers.slice().sort((a, b) => a.finger - b.finger);
  const open = chord.open || [];
  const muted = chord.muted || [];
  return (
    <ul className="m-0 flex min-w-0 list-none flex-col gap-1.5 p-0 text-sm">
      {fingers.map((f) => (
        <li key={f.finger} className="flex items-center gap-2 rounded-lg bg-soft px-2 py-1">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full font-display text-xs font-bold text-white" style={{ background: FINGER_COLORS[f.finger] }}>{f.finger}</span>
          <span>{f.label} · מיתר {f.string} · שריג {f.fret}</span>
        </li>
      ))}
      {muted.length > 0 && (
        <li className="flex items-center gap-2 px-2 py-1">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-bad font-display text-xs font-bold text-white">X</span>
          <span>{muted.length > 1 ? 'מיתרים' : 'מיתר'} {joinHe(muted)} · לא מנגנים</span>
        </li>
      )}
      {open.length > 0 && (
        <li className="flex items-center gap-2 px-2 py-1">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-ink font-display text-xs font-bold">O</span>
          <span>{open.length > 1 ? 'מיתרים' : 'מיתר'} {joinHe(open)} · פתוחים</span>
        </li>
      )}
    </ul>
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
