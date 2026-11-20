import { useEffect, useMemo, useRef, useState } from 'react';
import { grooveFor } from '../data/grooves';
import { barSeconds, fitSection, phaseFromTaps } from '../lib/lesson';
import { loadHighway, loadProgress, loadSyncOffset, saveHighway, saveProgress, saveSyncOffset } from '../lib/storage';
import { recordRun, PASS_FOR_BPM, STAR_RULES } from '../lib/progress';
import { createSongClock } from '../lib/songclock';
import { useLesson } from '../lib/useLesson';
import { bpmLabel } from '../lib/quality';
import Highway from './Highway';
import Icon from './Icon';
import Stars from './Stars';
import Timeline from './Timeline';

const MODES = [
  { id: 'demo', icon: 'eye', label: 'הדגמה', hint: 'האפליקציה מנגנת את הביט על הסט – רואים ושומעים.' },
  { id: 'practice', icon: 'drum', label: 'תרגול', hint: 'יש מטרונום; מנגנים על החלקים המסומנים ומקבלים משוב על כל מכה.' },
  { id: 'song', icon: 'note', label: 'עם השיר', hint: 'השיר מתנגן, והסט מראה מה לנגן לפי הסנכרון שקבעתם.' },
];
const SPEEDS = [0.5, 0.75, 1];
const STEP = 0.02; // 20ms
const BPM_STEP = 5;

// פאנל "ללמוד את השיר": סעיף, מצב, מהירות, לולאה, סנכרון עם השיר, וציון. + ציר הזמן (או "מסלול").
// בתרגיל טכניקה (exercise במקום song): קצב BPM עולה, ידיים R / L, בלי מצב "עם השיר".
// הסט עצמו (KitStage) מקבל את ההדגשות דרך boxRef; מכות המשתמש מגיעות דרך hitRef.
export default function LessonPanel({ song, exercise, kit, boxRef, hitRef, songApi, songLoaded, onLoadSong, onClose }) {
  const isEx = !!exercise;
  const [exBpm, setExBpm] = useState(exercise ? exercise.bpm : 100);
  const groove = isEx ? { bpm: exBpm, tip: exercise.desc, sections: [exercise.section] } : grooveFor(song.youtubeId);
  const title = isEx ? exercise.name : song.title;
  const itemId = isEx ? exercise.id : song.youtubeId;
  const [sectionId, setSectionId] = useState(groove.sections[0].id);
  const [highway, setHighway] = useState(loadHighway);
  const [last, setLast] = useState(null); // תוצאת הריצה האחרונה: { score, stars, newBest, bpm }
  const [saved, setSaved] = useState(loadProgress);
  const posRef = useRef(null);
  const [mode, setMode] = useState('demo');
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [countIn, setCountIn] = useState(true);
  // "עוד" = הסברים והגדרות מורחבות; במחשב פתוח, בטלפון מקופל כדי שהסט תמיד יישאר גדול על המסך
  const [more, setMore] = useState(() => !!window.matchMedia?.('(min-width: 1024px) and (min-height: 521px)').matches);
  const [offset, setOffset] = useState(() => (exercise ? 0 : loadSyncOffset(song.youtubeId)));
  const playheadRef = useRef(null);

  // שינוי שיר / תרגיל – טוענים את ההיסט שלו ומתחילים מהסעיף הראשון
  useEffect(() => {
    setSectionId(groove.sections[0].id);
    setOffset(isEx ? 0 : loadSyncOffset(song.youtubeId));
    setLast(null);
    if (exercise) setExBpm(exercise.bpm);
    setSaved(loadProgress());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const raw = groove.sections.find((s) => s.id === sectionId) || groove.sections[0];
  // מתאימים את הביט לחלקים שיש בסט (סט אישי יכול להיות בלי טום או רייד)
  const fit = useMemo(() => fitSection(raw, kit.pieces), [raw, kit.pieces]);
  const section = fit.section;

  const speedEff = isEx ? 1 : speed;
  const itemKey = isEx ? `ex:${exercise.id}` : `song:${song.youtubeId}:${section.id}`;
  const itemKeyRef = useRef(itemKey);
  itemKeyRef.current = itemKey;
  const bpmRef = useRef(groove.bpm);
  bpmRef.current = groove.bpm;

  // סוף תרגול: נספר רק אם נסגרה לפחות תיבה שלמה של מכות (ולא הדגמה); נשמר כוכבים, ציון שיא, רצף ודקות
  const onResult = (r) => {
    if (r.mode === 'demo' || r.notes < r.passNotes) return;
    const out = recordRun(loadProgress(), { key: itemKeyRef.current, score: r.score, speed: r.speed, seconds: r.seconds, bpm: isEx ? bpmRef.current : 0 });
    if (!out.counted) return;
    saveProgress(out.progress);
    setSaved(out.progress);
    setLast({ score: r.score, stars: out.stars, newBest: out.newBest, gained: out.gained, bpm: bpmRef.current });
  };

  const lesson = useLesson({ section, bpm: groove.bpm, mode, speed: speedEff, loop, countIn, voice: kit.voice, boxRef, playheadRef, songApi, offset, posRef, onResult });
  hitRef.current = lesson.hit;
  const item = saved.items[itemKey];
  const lookahead = barSeconds(groove.bpm, mode === 'song' ? 1 : speedEff) / 2; // שתי פעמות קדימה במסלול
  const toggleHighway = () => {
    saveHighway(!highway);
    setHighway(!highway);
  };
  const canRaise = isEx && last && last.score >= PASS_FOR_BPM && exBpm < exercise.target;
  const raise = () => {
    lesson.stop();
    setExBpm(Math.min(exercise.target, exBpm + BPM_STEP));
    setLast(null);
  };
  const modes = isEx ? MODES.filter((m) => m.id !== 'song') : MODES;
  const changeOffset = (v) => {
    setOffset(v);
    saveSyncOffset(song.youtubeId, v);
  };
  const beatSec = 60 / groove.bpm;
  const modeInfo = MODES.find((m) => m.id === mode);
  const showScore = mode !== 'demo' && (lesson.running || lesson.stats.perfect + lesson.stats.good + lesson.stats.missed > 0);
  const waitingSong = mode === 'song' && !songLoaded;
  // בטלפון אנכי, בזמן ריצה, הפאנל מצטמצם לפס אחד (עצירה + ציון) – ההגדרות חוזרות כשעוצרים או כשלוחצים "עוד".
  // מצב "עם השיר" בלי סנכרון עדיין צריך את פקדי הסנכרון, אז לא מצמצמים אותו
  const compact = lesson.running && !more && !(mode === 'song' && offset === 0);

  const switchMode = (id) => {
    lesson.stop();
    setMode(id);
  };

  return (
    <section className="lesson desk short:w-full flex flex-col" data-compact={compact} data-view={highway ? 'highway' : 'timeline'} aria-label={isEx ? 'תרגיל טכניקה' : 'ללמוד את השיר'}>
      <div className="px-3 py-2 phone:py-1.5 border-b border-black flex flex-col gap-2 phone:gap-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 flex flex-col phone:flex-row phone:items-center gap-2">
            <p className="lesson-title flex items-center gap-2 min-w-0"><span className="tape text-xl phone:text-lg truncate max-w-full">{isEx ? title : <bdi dir="ltr">{title}</bdi>}</span>{item && <Stars n={item.stars} label={`דירוג ${item.stars} מתוך 3`} />}</p>
            {/* בטלפון אנכי: ה-BPM ליד הכותרת (במקום שורה נפרדת); בזמן ריצה – תקציר המצב */}
            <span className="lcd px-1.5 text-[11px] tabular-nums shrink-0 hidden phone:inline lesson-bpm whitespace-nowrap" dir="ltr">{bpmLabel(groove.bpm)}</span>
            <span className="lesson-compact-label text-xs text-muted truncate">{modeInfo.label} · <bdi dir="ltr">{isEx ? `${groove.bpm} BPM` : `${Math.round(speed * 100)}%`}</bdi> · {section.name}</span>
            <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5 min-w-0 phone:hidden"><Icon name="cap" size={14} className="text-accent shrink-0" /><span className="truncate min-w-0">{isEx ? 'תרגיל,' : 'ביט מפושט,'}</span> <span className="lcd px-1.5 tabular-nums shrink-0 whitespace-nowrap" dir="ltr">{bpmLabel(groove.bpm)}</span></p>
          </div>
          <button type="button" className={`chip !min-h-9 !px-2.5 text-[13px] ${highway ? 'on' : ''}`} onClick={toggleHighway} aria-pressed={highway} aria-label="תצוגת מסלול (נוטות יורדות)" title="מסלול"><Icon name="highway" size={16} /><span className="phone:hidden">מסלול</span></button>
          <button type="button" className="btn !min-h-9 !px-3 text-sm" onClick={() => setMore(!more)} aria-expanded={more}>{more ? 'פחות' : 'עוד'} <Icon name={more ? 'chevronUp' : 'chevronDown'} size={16} /></button>
          <button type="button" className="btn !min-h-9 !px-3 text-sm" onClick={() => { lesson.stop(); onClose(); }} aria-label="סגירת מצב הלימוד"><Icon name="close" size={16} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 phone:gap-1">
          {waitingSong ? (
            <button type="button" className="btn btn-primary !min-h-9 !px-3 text-sm" onClick={() => onLoadSong(song.youtubeId)}>טעינת השיר</button>
          ) : (
            <button type="button" className="btn btn-primary !min-h-9 !px-4 phone:!px-3 text-sm min-w-[84px] phone:min-w-0" onClick={lesson.running ? lesson.stop : lesson.start} aria-pressed={lesson.running}>
              {lesson.running ? <><Icon name="stop" size={14} /> עצירה</> : <><Icon name="play" size={14} /> התחל</>}
            </button>
          )}
          {lesson.count > 0 && <span className="lcd font-extrabold text-xl w-9 text-center !text-cue tabular-nums" aria-live="polite">{lesson.count}</span>}
          {modes.map((m) => (
            <button key={m.id} type="button" className={`lesson-setup chip !min-h-9 !px-2.5 phone:!px-2 text-[13px] phone:text-[12.5px] ${mode === m.id ? 'on' : ''}`} aria-pressed={mode === m.id} onClick={() => switchMode(m.id)}><Icon name={m.icon} size={16} className="phone:hidden" />{m.label}</button>
          ))}
          {showScore && (
            <span className="ms-auto flex items-center gap-2 text-sm font-bold tabular-nums" aria-live="polite">
              <Vu value={lesson.stats.score} />
              <span className="lcd px-1.5 !text-good">{lesson.stats.score}%</span>
              <span className="text-xs text-muted font-semibold hidden lg:inline short:inline">מושלם {lesson.stats.perfect}, טוב {lesson.stats.good}, החמצות {lesson.stats.missed}</span>
            </span>
          )}
        </div>
        {/* מהירות + חלקי השיר באותה שורה (החלקים גוללים הצידה) */}
        <div className="lesson-setup flex items-center gap-1.5 min-w-0">
          {isEx ? (
            <>
              <span className="text-xs text-muted phone:hidden">קצב</span>
              <span className="flex items-center gap-1" dir="ltr">
                <button type="button" className="btn !min-h-9 !px-3 text-sm" aria-label="האט" onClick={() => { lesson.stop(); setExBpm(Math.max(40, exBpm - BPM_STEP)); }}>−</button>
                <span className="lcd px-2 py-1 text-sm font-bold tabular-nums" aria-label={`קצב ${exBpm}`}>{exBpm}</span>
                <button type="button" className="btn !min-h-9 !px-3 text-sm" aria-label="האץ" onClick={() => { lesson.stop(); setExBpm(Math.min(exercise.target, exBpm + BPM_STEP)); }}>+</button>
              </span>
              <span className="text-xs text-muted">יעד <bdi dir="ltr">{exercise.target}</bdi>{item?.bestBpm ? <> · שיא <bdi dir="ltr">{item.bestBpm}</bdi></> : null}</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted phone:hidden">מהירות</span>
              {SPEEDS.map((s) => (
                <button key={s} type="button" className={`chip !min-h-9 !px-2.5 text-[13px] shrink-0 ${speed === s ? 'on' : ''}`} aria-pressed={speed === s} onClick={() => setSpeed(s)}><bdi dir="ltr">{Math.round(s * 100)}%</bdi></button>
              ))}
              <span className="w-px self-stretch bg-black/60 mx-0.5 shrink-0" aria-hidden />
              <div className="flex gap-1.5 overflow-x-auto min-w-0 flex-1 pb-0.5" role="group" aria-label="חלק בשיר">
                {groove.sections.map((s) => (
                  <button key={s.id} type="button" className={`chip !min-h-9 !px-2.5 text-[13px] shrink-0 ${s.id === section.id ? 'on' : ''}`} aria-pressed={s.id === section.id} onClick={() => setSectionId(s.id)}>{s.name}</button>
                ))}
              </div>
            </>
          )}
        </div>
        {more && (
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={`chip !min-h-9 !px-2.5 text-[13px] ${loop ? 'on' : ''}`} aria-pressed={loop} onClick={() => setLoop(!loop)}><Icon name="loop" size={16} />לולאה</button>
              <button type="button" className={`chip !min-h-9 !px-2.5 text-[13px] ${countIn ? 'on' : ''}`} aria-pressed={countIn} onClick={() => setCountIn(!countIn)} disabled={mode === 'song'}><Icon name="metronome" size={16} />ספירה לפני</button>
            </div>
            <p className="text-xs text-muted">{modeInfo.hint}</p>
            <p className="text-xs flex items-start gap-1.5"><Icon name="bulb" size={16} className="text-accent mt-px" />{groove.tip}</p>
            {fit.notes.map((n) => (
              <p key={n} className="text-xs text-muted flex items-start gap-1.5"><Icon name="info" size={16} className="mt-px" />{n}</p>
            ))}
            {isEx ? (
              <p className="text-[11px] text-muted"><span className="hand-R font-bold">R</span> = ימין, <span className="hand-L font-bold">L</span> = שמאל; אות קטנה = מכה שקטה. כוכבים: <bdi dir="ltr">{STAR_RULES[0]}% / {STAR_RULES[1]}% / {STAR_RULES[2]}%</bdi>. מ-{PASS_FOR_BPM}% מוצע להעלות את הקצב.</p>
            ) : (
              <p className="text-[11px] text-muted">גרסה מפושטת של הביט המרכזי – לא תמלול מדויק של ההקלטה. כוכבים: <bdi dir="ltr">{STAR_RULES[0]}% / {STAR_RULES[1]}% / {STAR_RULES[2]}%</bdi>, שלושה כוכבים רק במהירות 100%.</p>
            )}
          </div>
        )}
        {last && !lesson.running && (
          <p className="lesson-result lcd px-2 py-1 text-xs flex flex-wrap items-center gap-x-2 gap-y-1" role="status" data-testid="lesson-result">
            <span>ציון <bdi dir="ltr">{last.score}%</bdi></span>
            <Stars n={last.stars} label={`${last.stars} כוכבים`} />
            {last.newBest && <span className="text-good font-bold">שיא חדש</span>}
            {canRaise && <button type="button" className="btn btn-primary !min-h-8 !px-2.5 text-xs" onClick={raise}>עוד {BPM_STEP} BPM</button>}
          </p>
        )}
        {mode === 'song' && songLoaded && (
          <SongSync songApi={songApi} bpm={groove.bpm} beatSec={beatSec} offset={offset} onOffset={changeOffset} status={lesson.status} running={lesson.running} />
        )}
      </div>
      {highway ? <Highway section={section} posRef={posRef} lookahead={lookahead} /> : <Timeline section={section} playheadRef={playheadRef} />}
    </section>
  );
}

// מד VU: 10 לדים לפי הציון (אדום בהתחלה, ענבר באמצע, ירוק בסוף)
function Vu({ value }) {
  const on = Math.round(value / 10);
  return (
    <span className="vu" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < on ? `on ${i < 3 ? 'low' : i < 6 ? 'mid' : ''}` : ''} />
      ))}
    </span>
  );
}

// סנכרון עם השיר: מקישים על פעמה כמה פעמים, והאפליקציה מחשבת מאיפה לספור. + כוונון עדין.
function SongSync({ songApi, bpm, beatSec, offset, onOffset, status, running }) {
  const [open, setOpen] = useState(offset === 0);
  const [taps, setTaps] = useState([]);
  const [msg, setMsg] = useState('');
  const clock = useRef(null);
  if (!clock.current) clock.current = createSongClock(songApi);

  const tap = () => {
    const s = clock.current.sample();
    if (!s || !s.playing) {
      setMsg('הפעילו את השיר בנגן (▶) ואז הקישו.');
      return;
    }
    // ההקשות הישנות מדי (יותר מ-4 שניות מהאחרונה) מתחילות סבב חדש
    const prev = taps[taps.length - 1];
    const base = prev !== undefined && s.time - prev < 4 && s.time > prev ? taps : [];
    const next = [...base, s.time].slice(-8);
    setTaps(next);
    const r = phaseFromTaps(next, bpm);
    if (r.ok) {
      onOffset(r.phase);
      setMsg(`נקבע! אם הדגשות מוקדמות או מאוחרות אפשר לכוונן למטה (${next.length} הקשות).`);
    } else if (r.reason === 'tempo') {
      setMsg('נראה שהקצב שונה – נסו שוב. הקישו בכל פעם שאתם שומעים את הפעמה (או את הפעמה הראשונה בתיבה).');
    } else if (r.reason === 'loose') {
      setMsg('ההקשות לא מספיק קבועות – נסו שוב, בקצב אחיד.');
    } else {
      setMsg(`עוד ${4 - next.length} הקשות…`);
    }
  };
  const ms = Math.round(offset * 1000);

  return (
    <div className="rounded-[5px] border border-black bg-black/30 px-2.5 py-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`chip !min-h-9 !px-2.5 text-[13px] ${open ? 'on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="target" size={16} />סנכרון</button>
        <span className="lcd text-xs px-1.5 py-0.5 tabular-nums" dir="ltr">{ms > 0 ? '+' : ''}{ms}ms</span>
        {status === 'paused' && running && <span className="text-xs font-bold text-bad">השיר מושהה – ההדגשות מחכות</span>}
        {status === 'noplayer' && running && <span className="text-xs font-bold text-bad">הנגן עוד לא מוכן</span>}
      </div>
      {open && (
        <>
          <p className="text-xs">הפעילו את השיר והקישו על הכפתור בכל פעם שאתם שומעים את הפעמה – הכי טוב את הפעמה הראשונה בתיבה (לפחות 4 פעמים).</p>
          <button type="button" className="btn btn-primary !min-h-14 text-lg w-full" onPointerDown={(e) => { e.preventDefault(); tap(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } }}>
            <Icon name="drum" size={22} /> הקשה בפעמה
          </button>
          {msg && <p className="text-xs font-semibold" role="status">{msg}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="btn !min-h-9 !px-2.5 text-[13px]" onClick={() => onOffset(offset - STEP)}>מוקדם יותר</button>
        <button type="button" className="btn !min-h-9 !px-2.5 text-[13px]" onClick={() => onOffset(offset + STEP)}>מאוחר יותר</button>
        <button type="button" className="btn !min-h-9 !px-2.5 text-[13px]" onClick={() => onOffset(offset + beatSec)} title="אם ההדגשות מתחילות בפעמה הלא נכונה">הזזה בפעמה</button>
        <button type="button" className="btn !min-h-9 !px-2.5 text-[13px]" onClick={() => { onOffset(0); setTaps([]); setMsg(''); }}>איפוס</button>
      </div>
      <p className="text-[11px] text-muted">הסנכרון לפי ההקשה שלכם; אם השיר מאט או מאיץ – אפשר לסנכרן שוב.</p>
    </div>
  );
}
