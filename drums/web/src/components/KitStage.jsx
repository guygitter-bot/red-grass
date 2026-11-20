import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PIECES, pieceForCode } from '../lib/kit';
import { layoutFor, STAGE_HEIGHT } from '../lib/layout';
import { finishOf } from '../lib/finish';
import { flashEl } from '../lib/padfx';
import { ensureAudio, playPiece } from '../lib/sounds';

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
export default function KitStage({ kit, keys = false, boxRef: outerRef, onUserHit }) {
  const ownRef = useRef(null);
  const boxRef = outerRef || ownRef;
  const hitCb = useRef(onUserHit);
  hitCb.current = onUserHit;
  const engine = useRef(null);
  const [use3d, setUse3d] = useState(webglOk);

  const hit = useCallback(
    (id) => {
      ensureAudio();
      playPiece(id, kit.voice);
      if (engine.current) engine.current.hit(id);
      else flashEl(boxRef.current?.querySelector(`[data-pad="${id}"]`));
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
      hit(id);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [keys, kit, hit]);

  const flat = <KitStage2D kit={kit} keys={keys} boxRef={boxRef} onHit={hit} />;
  if (!use3d) return flat;
  return (
    <Suspense fallback={flat}>
      <Stage3D kit={kit} keys={keys} padsRef={boxRef} onHit={hit} onFail={() => setUse3d(false)} onEngine={(e) => { engine.current = e; }} />
    </Suspense>
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
                onHit(p.id);
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
