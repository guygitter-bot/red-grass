import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PIECES, pieceForCode } from '../lib/kit';
import { layoutFor, STAGE_HEIGHT } from '../lib/layout';
import { finishOf } from '../lib/finish';
import { flashEl } from '../lib/padfx';
import { recoveryStep } from '../lib/quality';
import { ensureAudio, playPiece } from '../lib/sounds';
import { buzz, hapticsOn, hapticsSupported, setHaptics } from '../lib/haptics';
import { createVelocity } from '../lib/velocity';
import { zoneAt } from '../lib/zones';

// הבמה התלת־ממדית נטענת בנפרד (three.js כבד) – עד שהיא מוכנה מוצגת הבמה השטוחה
const Stage3D = lazy(() => import('../three/Stage3D'));

const GROUP = { kick: 'kick', snare: 'drum', hihat: 'cym', hihatOpen: 'cym', tom: 'drum', floor: 'drum', crash: 'cym', ride: 'cym', china: 'cym', splash: 'cym', cowbell: 'bell' };

// האם יש WebGL במכשיר (בלי WebGL – הבמה השטוחה בלבד)
let glOk = null;
function webglOk() {
  if (glOk !== null) return glOk;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    glOk = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    glOk = false;
  }
  return glOk;
}

// במת התופים: תלת־ממד (סט אמיתי על במה) או הבמה השטוחה כגיבוי. מגע מרובה, ומקלדת כש-keys.
// boxRef (לא חובה) = גישה לחלקים מבחוץ (מצב הלימוד מדגיש דרכו); onUserHit(id) = מכה של המשתמש
// מכה: info (לא חובה) = { r (היכן על החלק, 0..1), pressure, width, height, pointerType } ממגע; key: true למקלדת.
// מזה נגזרים אזור ההקשה (מרכז / שפה / פעמון...) ועוצמה, ואלה קובעים את הצליל, האנימציה והרטט
export default function KitStage({ kit, keys = false, boxRef: outerRef, onUserHit }) {
  const ownRef = useRef(null);
  const boxRef = outerRef || ownRef;
  const hitCb = useRef(onUserHit);
  hitCb.current = onUserHit;
  const engine = useRef(null);
  const [use3d, setUse3d] = useState(webglOk);
  // כמה פעמים הבמה התלת־ממדית נתקעה (מסך שחור / אובדן הקשר): פעם ראשונה בונים אותה מחדש באיכות נמוכה, פעם שנייה – הבמה השטוחה
  const [attempt, setAttempt] = useState(0);
  const trouble = useCallback(() => {
    if (recoveryStep(attempt) === 'safe') setAttempt(attempt + 1);
    else setUse3d(false);
  }, [attempt]);

  const vel = useRef(null);
  if (!vel.current) vel.current = createVelocity();
  const [buzzOn, setBuzzOn] = useState(hapticsOn);

  const hit = useCallback(
    (id, info) => {
      ensureAudio();
      const type = PIECES[id]?.type;
      const zone = zoneAt(type, info?.r);
      const v = vel.current.estimate(info, type, zone);
      playPiece(id, kit.voice, v, undefined, { vel: v, zone });
      buzz(type, v);
      if (engine.current) engine.current.hit(id, 0.45 + 0.85 * v, zone);
      else {
        const el = boxRef.current?.querySelector(`[data-pad="${id}"]`);
        if (el) el.dataset.zone = zone;
        flashEl(el);
      }
      hitCb.current?.(id);
    },
    [kit, boxRef],
  );

  // מקלדת במחשב (לפי e.code – עובד גם כשהמקלדת בעברית)
  useEffect(() => {
    if (!keys) return;
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const id = pieceForCode(kit.pieces, e.code);
      if (!id) return;
      e.preventDefault();
      hit(id, { key: true });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [keys, kit, hit]);

  const flat = <KitStage2D kit={kit} keys={keys} boxRef={boxRef} onHit={hit} />;
  const toggleBuzz = () => {
    setHaptics(!buzzOn);
    setBuzzOn(!buzzOn);
  };
  const stage = use3d ? (
    <Suspense fallback={flat}>
      <Stage3D key={attempt} safe={attempt > 0} kit={kit} keys={keys} padsRef={boxRef} onHit={hit} onFail={() => setUse3d(false)} onTrouble={trouble} onEngine={(e) => { engine.current = e; }} />
    </Suspense>
  ) : (
    flat
  );
  return (
    <div className="relative flex-1 min-h-0 min-w-0 flex">
      {stage}
      {/* מתג רטט – רק במכשיר שתומך (אנדרואיד) */}
      {hapticsSupported() && (
        <button type="button" className="stage-toggle stage-toggle-2" onClick={toggleBuzz} aria-pressed={buzzOn} title="רטט בכל מכה">
          <span className="led" aria-hidden />
          רטט
        </button>
      )}
    </div>
  );
}

// הבמה השטוחה: חלקים עגולים במבנה שמותאם ליחס המסך
function KitStage2D({ kit, keys, boxRef, onHit }) {
  const wrapRef = useRef(null);
  const [mode, setMode] = useState('wide');

  // רחב או גבוה – לפי היחס של האזור הפנוי
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMode(width / Math.max(height, 1) >= 1.15 ? 'wide' : 'tall');
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const H = STAGE_HEIGHT[mode];
  const pads = layoutFor(kit.pieces, mode);

  return (
    <div ref={wrapRef} className="stage relative flex-1 min-h-0 min-w-0 grid place-items-center overflow-hidden">
      <div
        ref={boxRef}
        className="kit-box"
        data-finish={finishOf(kit)}
        dir="ltr"
        style={{ width: `min(100%, calc((100cqh) * 100 / ${H}))`, aspectRatio: `100 / ${H}` }}
      >
        {pads.map((p) => {
          const spec = PIECES[p.id];
          return (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              data-pad={p.id}
              aria-label={spec.label}
              className={`pad pad-${GROUP[spec.type]}`}
              style={{ left: `${p.x}%`, top: `${(p.y / H) * 100}%`, width: `${p.s}%`, '--s': p.s }}
              onPointerDown={(e) => {
                e.preventDefault();
                // היכן על החלק פגעו: מרחק מהמרכז ביחס לרדיוס (0 מרכז .. 1 שפה)
                const b = e.currentTarget.getBoundingClientRect();
                const r = Math.hypot((e.clientX - (b.left + b.width / 2)) / (b.width / 2), (e.clientY - (b.top + b.height / 2)) / (b.height / 2));
                onHit(p.id, { r: Math.min(1, r), pressure: e.pressure, width: e.width, height: e.height, pointerType: e.pointerType });
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="pad-label" dir="rtl">
                <span>{spec.label}</span>
                {keys && <span className="key-hint">{spec.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
