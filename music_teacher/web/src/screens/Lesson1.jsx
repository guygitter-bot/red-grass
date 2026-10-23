import { useEffect, useRef, useState } from 'react';
import GuitarStage from '../components/GuitarStage';
import LessonLayout from '../components/LessonLayout';
import { LESSON1, pick } from '../lib/lessons';
import { STRINGS, STRING_ORDER, stringLabel, fretFreq } from '../lib/notes';
import { freqToNote } from '../lib/pitch';
import { playString, unlockAudio } from '../lib/audio';
import { markLessonDone } from '../lib/storage';
import { IconSpeaker, IconReplay } from '../components/Icons';

const FRETS = [0, 2, 5, 7, 12];
const ROUNDS = 5;

export default function Lesson1({ type }) {
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState(null);
  const [fret, setFret] = useState(0);
  const [activeStr, setActiveStr] = useState(0);
  const step = LESSON1[idx];
  const stageRef = useRef(null);
  const timers = useRef([]);
  stageRef.current = stage;
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // המצלמה, ההדגשות והתוויות לפי השלב
  useEffect(() => {
    if (!stage) return;
    stage.setCamera(step.camera);
    stage.setFocus({ parts: pick(step.parts, type), labels: pick(step.labels, type) });
    stage.showBadges(step.tool === 'strings' || step.tool === 'quiz');
    stage.setLeftHand({ fingers: [], at: step.handAt || 2 });
    stage.setRightHand(step.park ? 'park' : 'play');
    setFret(0);
    setActiveStr(0);
    if (step.pose === 'greet') stage.wave(2.6);
  }, [stage, idx, type]);

  // סיום השיעור נשמר
  useEffect(() => {
    if (step.id === 'finish') markLessonDone(1);
  }, [idx]);

  const pluck = (i) => {
    unlockAudio();
    setActiveStr(i);
    if (stage) stage.pluck(i);
  };
  const playAll = () => {
    unlockAudio();
    STRING_ORDER.forEach((s, n) => later(() => {
      if (stageRef.current) {
        setActiveStr(s);
        stageRef.current.pluck(s);
      }
    }, n * 650));
  };

  const setFretDemo = (n) => {
    unlockAudio();
    setFret(n);
    if (!stage) return;
    stage.setLeftHand({ fingers: n > 0 ? [{ finger: 1, string: 3, fret: n }] : [], at: 15 });
    later(() => stageRef.current && stageRef.current.pluck(3), n > 0 ? 450 : 50);
  };

  let tools = null;
  if (step.tool === 'agenda') {
    tools = (
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
        {['ראש הגיטרה ומפתחות הכיוון', 'הצוואר, השריגים והמיתרים', 'הגוף והגשר', 'שמות ששת המיתרים + בוחן קטן', 'כוונון עם המיקרופון'].map((t, n) => (
          <li key={t} className="flex items-center gap-2.5 rounded-xl bg-soft px-3 py-2">
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">{n + 1}</span>
            {t}
          </li>
        ))}
      </ul>
    );
  } else if (step.tool === 'frets') {
    const note = freqToNote(fretFreq(3, fret));
    tools = (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-bold text-muted">לחצו על מיתר 3 בשריג:</div>
        <div className="grid grid-cols-5 gap-1.5">
          {FRETS.map((n) => (
            <button key={n} type="button" className={`chip ${fret === n ? 'on' : ''}`} onClick={() => setFretDemo(n)} aria-pressed={fret === n}>
              {n === 0 ? 'פתוח' : `שריג ${n}`}
            </button>
          ))}
        </div>
        <p className="m-0 rounded-xl bg-soft px-3 py-2 text-sm">
          {fret === 0 ? 'מיתר פתוח: כל האורך רוטט, והצליל הוא סול (G).' : `הלחיצה מקצרת את המיתר, והצליל עלה: ${note.he} (${note.name}). ככל שמתקרבים לגוף הצליל גבוה יותר.`}
        </p>
      </div>
    );
  } else if (step.tool === 'strings') {
    tools = (
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-6 gap-1.5">
          {STRING_ORDER.map((n) => (
            <button key={n} type="button" className={`chip ${activeStr === n ? 'on' : ''}`} onClick={() => pluck(n)} aria-label={stringLabel(n)}>
              {n} · {STRINGS[n].note}
            </button>
          ))}
        </div>
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1 rounded-xl bg-soft px-3 py-2 text-[15px]" aria-live="polite">
            {activeStr ? (
              <>
                <b>{stringLabel(activeStr)}</b>
                {STRINGS[activeStr].thick && <span> · {STRINGS[activeStr].thick}</span>}
              </>
            ) : (
              'בחרו מיתר כדי לשמוע אותו.'
            )}
          </div>
          <button type="button" className="btn btn-primary flex-none" onClick={playAll}>
            <IconSpeaker /> נגן את כולם
          </button>
        </div>
      </div>
    );
  } else if (step.tool === 'quiz') {
    tools = <Quiz type={type} stage={stage} />;
  } else if (step.tool === 'finish') {
    tools = (
      <div className="flex flex-col gap-2.5">
        <a href="#/tuner" className="btn btn-primary no-underline">עכשיו נכוון את הגיטרה</a>
        <a href="#/lesson/2" className="btn no-underline">לשיעור הבא: אקורד Am</a>
      </div>
    );
  }

  const title = pick(step.title, type);
  return (
    <LessonLayout
      steps={LESSON1}
      idx={idx}
      setIdx={setIdx}
      title={title}
      say={pick(step.say, type)}
      tools={tools}
      lastLabel="לרשימת השיעורים"
      onFinish={() => {
        window.location.hash = '#/';
      }}
      stageNode={
        <GuitarStage
          type={type}
          className="min-h-0 flex-1"
          onStage={setStage}
          onPick={(i) => {
            if (step.tool === 'strings') pluck(i);
          }}
        >
          <div className="pointer-events-none absolute bottom-2 start-3 end-3 text-center text-xs text-ink/80 [text-shadow:0_1px_2px_var(--color-scene)]">גררו עם האצבע כדי להסתכל מזווית אחרת</div>
        </GuitarStage>
      }
    />
  );
}

// בוחן "איזה מיתר שמעת?"
function Quiz({ type, stage }) {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(0);
  const [chosen, setChosen] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const targetRef = useRef(0);

  const ask = (prev) => {
    let s = 1 + Math.floor(Math.random() * 6);
    while (s === prev) s = 1 + Math.floor(Math.random() * 6);
    targetRef.current = s;
    setTarget(s);
    setChosen(0);
    unlockAudio();
    setTimeout(() => playString(type, s, { gain: 0.55 }), 120);
  };
  const start = () => {
    setRound(1);
    setScore(0);
    setDone(false);
    ask(0);
  };
  const answer = (n) => {
    if (chosen || done || !target) return;
    setChosen(n);
    if (n === target) setScore((v) => v + 1);
    if (stage) stage.pluck(target);
  };
  const next = () => {
    if (round >= ROUNDS) setDone(true);
    else {
      setRound(round + 1);
      ask(target);
    }
  };

  if (!round) {
    return (
      <button type="button" className="btn btn-primary self-start" onClick={start}>
        <IconSpeaker /> מתחילים
      </button>
    );
  }
  if (done) {
    const msg = score >= 5 ? 'מושלם! אוזן מצוינת.' : score >= 3 ? 'יפה מאוד! עוד קצת תרגול ויהיה מושלם.' : 'התחלה טובה. נסו שוב, ושימו לב: מיתר עבה נשמע נמוך ועמוק.';
    return (
      <div className="flex flex-col gap-2.5">
        <div className="rounded-xl border border-good bg-good-soft px-3 py-2.5 font-bold text-good" role="status">
          ענית נכון על {score} מתוך {ROUNDS}. {msg}
        </div>
        <button type="button" className="btn self-start" onClick={start}><IconReplay /> עוד סיבוב</button>
      </div>
    );
  }
  const right = chosen && chosen === target;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-sm font-bold text-muted">
        <span>שאלה {round} מתוך {ROUNDS}</span>
        <button type="button" className="btn !min-h-9 text-sm" onClick={() => playString(type, target, { gain: 0.55 })}><IconSpeaker width={16} height={16} /> שמעו שוב</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STRING_ORDER.map((n) => {
          const state = !chosen ? '' : n === target ? 'good' : n === chosen ? 'bad' : '';
          return (
            <button
              key={n}
              type="button"
              disabled={!!chosen && state === ''}
              onClick={() => answer(n)}
              className={`btn !min-h-12 flex-col !gap-0 ${state === 'good' ? '!border-good !bg-good-soft !text-good' : state === 'bad' ? '!border-bad !bg-bad-soft !text-bad' : ''}`}
            >
              <b>מיתר {n}</b>
              <span className="text-xs font-normal">{STRINGS[n].name}</span>
            </button>
          );
        })}
      </div>
      {chosen ? (
        <div className="flex flex-col gap-2" role="status">
          <div className={`rounded-xl px-3 py-2 font-bold ${right ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
            {right ? `נכון! זה מיתר ${target} (${STRINGS[target].he}).` : `כמעט! זה היה מיתר ${target} (${STRINGS[target].he}). הסתכלו איך המורה פורט אותו.`}
          </div>
          <button type="button" className="btn btn-primary self-start" onClick={next}>{round >= ROUNDS ? 'לתוצאה' : 'השאלה הבאה'}</button>
        </div>
      ) : (
        <p className="m-0 text-sm text-muted">איזה מיתר שמעתם?</p>
      )}
    </div>
  );
}
