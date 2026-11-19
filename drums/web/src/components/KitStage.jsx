import { useCallback, useEffect, useRef, useState } from 'react';
import { PIECES, pieceForCode } from '../lib/kit';
import { layoutFor, STAGE_HEIGHT } from '../lib/layout';
import { flashEl } from '../lib/padfx';
import { ensureAudio, playPiece } from '../lib/sounds';


const GROUP = { kick: 'kick', snare: 'drum', hihat: 'cym', hihatOpen: 'cym', tom: 'drum', floor: 'drum', crash: 'cym', ride: 'cym', china: 'cym', splash: 'cym', cowbell: 'bell' };

// במת התופים: חלקים לחיצים (מגע מרובה) במבנה שמותאם ליחס המסך. keys = גם מקלדת.
// boxRef (לא חובה) = גישה לאלמנט הסט מבחוץ (מצב הלימוד מדגיש עליו חלקים); onUserHit(id) = מכה של המשתמש
export default function KitStage({ kit, keys = false, boxRef: outerRef, onUserHit }) {
  const wrapRef = useRef(null);
  const ownRef = useRef(null);
  const boxRef = outerRef || ownRef;
  const hitCb = useRef(onUserHit);
  hitCb.current = onUserHit;
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

  const hit = useCallback(
    (id) => {
      ensureAudio();
      playPiece(id, kit.voice);
      flashEl(boxRef.current?.querySelector(`[data-pad="${id}"]`));
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

  const H = STAGE_HEIGHT[mode];
  const pads = layoutFor(kit.pieces, mode);

  return (
    <div ref={wrapRef} className="stage relative flex-1 min-h-0 min-w-0 grid place-items-center overflow-hidden">
      <div
        ref={boxRef}
        className="kit-box"
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
                hit(p.id);
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
