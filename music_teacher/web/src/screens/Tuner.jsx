import { useEffect, useRef, useState } from 'react';
import Headstock from '../components/Headstock';
import { STRINGS, STRING_ORDER } from '../lib/notes';
import { detectPitch, freqToNote, centsOff, nearestString, rms } from '../lib/pitch';
import { startMic, micErrorMessage } from '../lib/mic';
import { playReference, stopReference, unlockAudio } from '../lib/audio';
import { IconMic, IconStop, IconSpeaker, IconCheck } from '../components/Icons';

const IN_TUNE = 5; // סנט
const HOLD_MS = 500;

// קשת המכוון: -50..+50 סנט
function Gauge({ cents, active, ok }) {
  const clamped = Math.max(-50, Math.min(50, cents));
  const ang = (clamped / 50) * 60; // מעלות מהאמצע
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
  };
  const arc = (d0, d1, r) => {
    const [x0, y0] = pt(d0, r);
    const [x1, y1] = pt(d1, r);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const okDeg = (IN_TUNE / 50) * 60;
  const ticks = [-50, -25, 0, 25, 50];
  return (
    <svg viewBox="0 0 200 118" role="img" aria-label="מד הכוונון" className="mx-auto block h-auto w-full max-w-[420px]" style={{ direction: 'ltr' }}>
      <path d={arc(-60, 60, 84)} stroke="var(--color-line)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(-okDeg, okDeg, 84)} stroke="var(--color-good)" strokeWidth="14" fill="none" opacity={ok ? 1 : 0.55} />
      {ticks.map((t) => {
        const d = (t / 50) * 60;
        const [x0, y0] = pt(d, 70);
        const [x1, y1] = pt(d, 62);
        return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--color-muted)" strokeWidth="2" />;
      })}
      <text x="22" y="112" fontSize="9" fill="var(--color-muted)" textAnchor="middle">נמוך</text>
      <text x="178" y="112" fontSize="9" fill="var(--color-muted)" textAnchor="middle">גבוה</text>
      <g style={{ transform: `rotate(${active ? ang : 0}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.12s linear' }} opacity={active ? 1 : 0.3}>
        <line x1="100" y1="100" x2="100" y2="28" stroke={ok ? 'var(--color-good)' : 'var(--color-accent)'} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="7" fill="var(--color-ink)" />
    </svg>
  );
}

export default function Tuner({ type }) {
  const [state, setState] = useState('idle'); // idle | starting | on | error
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(0); // 0 = אוטומטי
  const [read, setRead] = useState(null); // { freq, note, string, cents }
  const [ok, setOk] = useState(false);
  const micRef = useRef(null);
  const manualRef = useRef(0);
  const sm = useRef({ cents: 0, lastSeen: 0, inSince: 0, freq: 0 });
  manualRef.current = manual;

  // ביציאה מהמסך סוגרים את המיקרופון והצליל
  useEffect(() => {
    return () => {
      if (micRef.current) micRef.current.stop();
      micRef.current = null;
      stopReference();
    };
  }, []);

  const onFrame = (buf, sr) => {
    const now = performance.now();
    const s = sm.current;
    const p = rms(buf) > 0 ? detectPitch(buf, sr) : null;
    if (p && p.clarity > 0.8) {
      const sel = manualRef.current;
      const near = nearestString(p.freq);
      const target = sel ? { string: sel, target: STRINGS[sel].freq, cents: centsOff(p.freq, STRINGS[sel].freq) } : near;
      // החלקה: ממוצע נע של הסנטים (קפיצה גדולה מתחילה מחדש)
      if (Math.abs(target.cents - s.cents) > 40 || now - s.lastSeen > 700) s.cents = target.cents;
      else s.cents += (target.cents - s.cents) * 0.35;
      s.lastSeen = now;
      s.freq = p.freq;
      const inRange = Math.abs(s.cents) <= IN_TUNE;
      if (inRange) {
        if (!s.inSince) s.inSince = now;
      } else s.inSince = 0;
      setOk(!!s.inSince && now - s.inSince >= HOLD_MS);
      setRead({ freq: p.freq, note: freqToNote(p.freq), string: target.string, cents: s.cents, far: Math.abs(target.cents) > 300 });
    } else if (now - s.lastSeen > 700) {
      s.inSince = 0;
      setOk(false);
      setRead((r) => (r ? null : r));
    }
  };

  const start = async () => {
    unlockAudio();
    setState('starting');
    try {
      micRef.current = await startMic(onFrame);
      setState('on');
    } catch (e) {
      setErr(micErrorMessage(e));
      setState('error');
    }
  };
  const stop = () => {
    if (micRef.current) micRef.current.stop();
    micRef.current = null;
    setState('idle');
    setRead(null);
    setOk(false);
  };

  const shown = manual || (read ? read.string : 0);
  const cents = read ? read.cents : 0;
  let guide = 'פרטו מיתר פתוח ונשמע אותו.';
  let tone = 'bg-soft text-ink';
  if (state !== 'on') guide = 'לחצו על "הפעילו מיקרופון" ופרטו מיתר.';
  else if (read) {
    if (read.far && manual) {
      guide = `שמעתי ${read.note.name}. נסו לפרוט את מיתר ${manual} (${STRINGS[manual].name}).`;
    } else if (ok) {
      guide = 'מכוון! ✓';
      tone = 'bg-good-soft text-good';
    } else if (cents < -IN_TUNE) guide = 'נמוך מדי – לסובב את המפתח כדי להדק';
    else if (cents > IN_TUNE) guide = 'גבוה מדי – לשחרר מעט';
    else guide = 'כמעט! החזיקו עוד רגע...';
  }

  const refString = manual || (read ? read.string : 0);

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-4 pb-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4" aria-label="המכוון">
          <div className="flex items-center justify-between gap-3">
            {state !== 'on' ? (
              <button type="button" className="btn btn-primary" onClick={start} disabled={state === 'starting'}>
                <IconMic /> {state === 'starting' ? 'מפעיל...' : 'הפעילו מיקרופון'}
              </button>
            ) : (
              <button type="button" className="btn" onClick={stop}>
                <IconStop width={16} height={16} /> עצרו
              </button>
            )}
            <span className="text-sm text-muted">{state === 'on' ? 'מקשיב...' : ''}</span>
          </div>

          {state === 'error' && <div className="rounded-xl bg-bad-soft px-3 py-2.5 text-sm font-semibold text-bad" role="alert">{err}</div>}

          <div className="text-center">
            <div className="font-display text-[84px] font-extrabold leading-none" aria-live="polite" style={{ color: ok ? 'var(--color-good)' : 'var(--color-ink)' }}>
              {read ? read.note.name.replace('#', '♯') : '–'}
              {read && <span className="ms-1 align-top text-2xl font-bold text-muted">{read.note.octave}</span>}
            </div>
            <div className="mt-1 h-6 text-base text-muted">
              {read ? `${read.note.he} · ${read.freq.toFixed(1)} הרץ` : ''}
            </div>
          </div>

          <Gauge cents={cents} active={!!read} ok={ok} />

          <div className={`rounded-xl px-3 py-3 text-center text-lg font-bold ${tone}`} role="status" aria-live="polite">
            {ok && <IconCheck className="me-1 inline" />}
            {guide}
          </div>
          <div className="text-center text-sm text-muted" aria-live="polite">
            {read ? `${cents > 0 ? '+' : ''}${Math.round(cents)} סנט` : ' '}
            {read && shown ? ` · מיתר ${shown} (${STRINGS[shown].name})` : ''}
          </div>

          <div>
            <div className="mb-1.5 text-sm font-bold text-muted">איזה מיתר מכוונים?</div>
            <div className="grid grid-cols-7 gap-1.5">
              <button type="button" className={`chip ${manual === 0 ? 'on' : ''}`} aria-pressed={manual === 0} onClick={() => setManual(0)}>אוטו׳</button>
              {STRING_ORDER.map((n) => (
                <button key={n} type="button" className={`chip ${manual === n ? 'on' : ''}`} aria-pressed={manual === n} onClick={() => setManual(n)} aria-label={`מיתר ${n} ${STRINGS[n].name}`}>
                  {n}·{STRINGS[n].note}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className="btn"
              disabled={!refString}
              onClick={() => {
                unlockAudio();
                playReference(refString);
              }}
            >
              <IconSpeaker /> {refString ? `שמעו את מיתר ${refString} (${STRINGS[refString].he})` : 'בחרו מיתר כדי לשמוע את הצליל הנכון'}
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-line bg-card p-4" aria-label="איזה מפתח לסובב">
          <div className="mb-2 text-center text-sm font-bold">{shown ? `מסובבים את המפתח של מיתר ${shown}` : 'המפתחות בראש הגיטרה'}</div>
          <Headstock type={type} active={shown} detected={read ? read.string : 0} />
          <p className="m-0 mt-2 text-center text-xs text-muted">
            {type === 'classical' ? 'גיטרה קלאסית: שלושה מפתחות בכל צד' : 'גיטרה חשמלית: שישה מפתחות בשורה'}
          </p>
        </aside>
      </div>
    </div>
  );
}
