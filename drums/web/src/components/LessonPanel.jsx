import { useEffect, useMemo, useRef, useState } from 'react';
import { grooveFor } from '../data/grooves';
import { fitSection, phaseFromTaps } from '../lib/lesson';
import { loadSyncOffset, saveSyncOffset } from '../lib/storage';
import { createSongClock } from '../lib/songclock';
import { useLesson } from '../lib/useLesson';
import Icon from './Icon';
import Timeline from './Timeline';

const MODES = [
  { id: 'demo', icon: 'eye', label: 'הדגמה', hint: 'האפליקציה מנגנת את הביט על הסט – רואים ושומעים.' },
  { id: 'practice', icon: 'drum', label: 'תרגול', hint: 'יש מטרונום; מנגנים על החלקים המסומנים ומקבלים משוב על כל מכה.' },
  { id: 'song', icon: 'note', label: 'עם השיר', hint: 'השיר מתנגן, והסט מראה מה לנגן לפי הסנכרון שקבעתם.' },
];
const SPEEDS = [0.5, 0.75, 1];
const STEP = 0.02; // 20ms

// פאנל "ללמוד את השיר": סעיף, מצב, מהירות, לולאה, סנכרון עם השיר, וציון. + ציר הזמן.
// הסט עצמו (KitStage) מקבל את ההדגשות דרך boxRef; מכות המשתמש מגיעות דרך hitRef.
export default function LessonPanel({ song, kit, boxRef, hitRef, songApi, songLoaded, onLoadSong, onClose }) {
  const groove = grooveFor(song.youtubeId);
  const [sectionId, setSectionId] = useState(groove.sections[0].id);
  const [mode, setMode] = useState('demo');
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [countIn, setCountIn] = useState(true);
  // "עוד" = הסברים והגדרות מורחבות; במחשב פתוח, בטלפון מקופל כדי שהסט תמיד יישאר גדול על המסך
  const [more, setMore] = useState(() => !!window.matchMedia?.('(min-width: 1024px) and (min-height: 521px)').matches);
  const [offset, setOffset] = useState(() => loadSyncOffset(song.youtubeId));
  const playheadRef = useRef(null);

  // שינוי שיר – טוענים את ההיסט שלו ומתחילים מהסעיף הראשון
  useEffect(() => {
    setSectionId(groove.sections[0].id);
    setOffset(loadSyncOffset(song.youtubeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.youtubeId]);

  const raw = groove.sections.find((s) => s.id === sectionId) || groove.sections[0];
  // מתאימים את הביט לחלקים שיש בסט (סט אישי יכול להיות בלי טום או רייד)
  const fit = useMemo(() => fitSection(raw, kit.pieces), [raw, kit.pieces]);
  const section = fit.section;

  const lesson = useLesson({ section, bpm: groove.bpm, mode, speed, loop, countIn, voice: kit.voice, boxRef, playheadRef, songApi, offset });
  hitRef.current = lesson.hit;

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
    <section className="lesson desk short:w-full flex flex-col" data-compact={compact} aria-label="ללמוד את השיר">
      <div className="px-3 py-2 phone:py-1.5 border-b border-black flex flex-col gap-2 phone:gap-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 flex flex-col phone:flex-row phone:items-center gap-2">
            <p className="lesson-title flex items-center gap-2 min-w-0"><span className="tape text-xl phone:text-lg truncate max-w-full"><bdi dir="ltr">{song.title}</bdi></span></p>
            {/* בטלפון אנכי: ה-BPM ליד הכותרת (במקום שורה נפרדת); בזמן ריצה – תקציר המצב */}
            <span className="lcd px-1.5 text-[11px] tabular-nums shrink-0 hidden phone:inline lesson-bpm" dir="ltr">{groove.bpm} BPM</span>
            <span className="lesson-compact-label text-xs text-muted truncate">{modeInfo.label} · <bdi dir="ltr">{Math.round(speed * 100)}%</bdi> · {section.name}</span>
            <p className="text-[11px] text-muted truncate mt-1 flex items-center gap-1.5 phone:hidden"><Icon name="cap" size={14} className="text-accent shrink-0" />ביט מפושט, <span className="lcd px-1.5 tabular-nums" dir="ltr">{groove.bpm} BPM</span></p>
          </div>
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
          {MODES.map((m) => (
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
            <p className="text-[11px] text-muted">גרסה מפושטת של הביט המרכזי – לא תמלול מדויק של ההקלטה.</p>
          </div>
        )}
        {mode === 'song' && songLoaded && (
          <SongSync songApi={songApi} bpm={groove.bpm} beatSec={beatSec} offset={offset} onOffset={changeOffset} status={lesson.status} running={lesson.running} />
        )}
      </div>
      <Timeline section={section} playheadRef={playheadRef} />
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
