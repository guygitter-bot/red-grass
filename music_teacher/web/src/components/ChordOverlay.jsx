import { useEffect, useRef } from 'react';
import { FINGER_COLORS, STRINGS } from '../lib/chord';

// שכבת אקורד בסגנון סרטון הדרכה (HTML מעל הבמה, לא תלת־ממד): שם האקורד בזוהר צהוב, ומתחתיו לוח אופקי –
// האום מימין (כמו הצוואר בסרטון: הראש מימין), שמות המיתרים משמאל (מיתר 6 למעלה), עיגולים ממוספרים בצבע האצבע, X ו-O ליד האום.
// הכול נגזר ממפרט האקורד (lib/chord.js). down = אילו אצבעות כבר "ירדו" באנימציה (העיגול קופץ פנימה עם האצבע).
const LETTERS = ['E', 'A', 'D', 'G', 'B', 'E']; // מיתר 6 עד 1 (כוונון רגיל)
const X0 = 22; // תחילת הלוח (אחרי האותיות)
const CW = 52; // רוחב משבצת (שריג)
const RH = 19; // מרווח בין מיתרים
const Y0 = 14;

export default function ChordOverlay({ chord, down, onInset }) {
  const ref = useRef(null);
  // מדווחים לבמה כמה מגובהה תפוס, כדי שהמצלמה תסגור את הצוואר מעל השכבה ולא מאחוריה
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement || !onInset) return undefined;
    const par = el.parentElement;
    const measure = () => onInset(Math.min(0.6, el.offsetHeight / Math.max(1, par.clientHeight)));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) {
      ro.observe(el);
      ro.observe(par);
    }
    return () => {
      if (ro) ro.disconnect();
      onInset(0);
    };
  }, [onInset, chord]);

  const fingers = (chord.fingers || []).slice().sort((a, b) => a.finger - b.finger);
  const open = chord.open || [];
  const muted = chord.muted || [];
  const cols = Math.max(4, ...fingers.map((f) => f.fret));
  const X1 = X0 + cols * CW; // האום
  const W = X1 + 36;
  const H = Y0 + (STRINGS - 1) * RH + 12;
  const sy = (s) => Y0 + (STRINGS - s) * RH; // מיתר 6 למעלה
  const fx = (fret) => X1 - (fret - 0.5) * CW;
  const downSet = new Set(down || []);
  const desc = fingers.map((f) => `אצבע ${f.finger} במיתר ${f.string} שריג ${f.fret}`).join(', ');
  return (
    <div ref={ref} className="chord-overlay" dir="ltr">
      <div className="chord-name" lang="en">{chord.name}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`דיאגרמת אקורד ${chord.name}: ${desc}`} className="chord-board">
        <g stroke="rgba(255,244,225,0.8)" strokeLinecap="round">
          {/* שריגים */}
          {Array.from({ length: cols }, (_, k) => <line key={k} x1={X0 + k * CW} y1={Y0} x2={X0 + k * CW} y2={sy(1)} strokeWidth="1.4" />)}
          {/* האום */}
          <line x1={X1} y1={Y0 - 2} x2={X1} y2={sy(1) + 2} strokeWidth="5" stroke="#fff4e1" />
          {/* מיתרים: עבים יותר בבס */}
          {[6, 5, 4, 3, 2, 1].map((s) => <line key={s} x1={X0} y1={sy(s)} x2={X1} y2={sy(s)} strokeWidth={0.9 + (s - 1) * 0.28} />)}
        </g>
        <g fontFamily="Rubik, sans-serif" fontWeight="700" fontSize="12" fill="rgba(255,236,200,0.9)" textAnchor="middle">
          {[6, 5, 4, 3, 2, 1].map((s) => <text key={s} x={9} y={sy(s) + 4.2}>{LETTERS[6 - s]}</text>)}
        </g>
        <g fontFamily="Rubik, sans-serif" fontWeight="800" textAnchor="middle">
          {muted.map((s) => <text key={`x${s}`} x={X1 + 20} y={sy(s) + 5.5} fontSize="16" fill="#ff8d6b">×</text>)}
          {open.map((s) => <circle key={`o${s}`} cx={X1 + 20} cy={sy(s)} r="5" fill="none" stroke="#fff4e1" strokeWidth="1.8" />)}
          {fingers.map((f) => (
            <g key={f.finger} className={`chord-dot ${downSet.has(f.finger) ? 'on' : ''}`} style={{ transformOrigin: `${fx(f.fret)}px ${sy(f.string)}px` }}>
              <circle cx={fx(f.fret)} cy={sy(f.string)} r="8.6" fill={FINGER_COLORS[f.finger]} stroke="#fff" strokeWidth="1.6" />
              <text x={fx(f.fret)} y={sy(f.string) + 4.3} fontSize="12" fill="#fff">{f.finger}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
