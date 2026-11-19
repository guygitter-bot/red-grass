import { useCallback, useEffect, useRef, useState } from 'react';
import { PIECES, pieceForCode } from '../lib/kit';
import { layoutFor, STAGE_HEIGHT } from '../lib/layout';
import { ensureAudio, playPiece } from '../lib/sounds';

// הבהוב קצר של חלק שהוכה (בלי רינדור מחדש – מוסיפים מחלקה ומאתחלים את האנימציה)
function flash(el) {
  if (!el) return;
  el.classList.remove('hit');
  void el.offsetWidth;
  el.classList.add('hit');
}

const GROUP = { kick: 'kick', snare: 'drum', hihat: 'cym', hihatOpen: 'cym', tom: 'drum', floor: 'drum', crash: 'cym', ride: 'cym', china: 'cym', splash: 'cym', cowbell: 'bell' };

// במת התופים: חלקים לחיצים (מגע מרובה) במבנה שמותאם ליחס המסך. keys = גם מקלדת
export default function KitStage({ kit, keys = false }) {
  const wrapRef = useRef(null);
  const boxRef = useRef(null);
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
      flash(boxRef.current?.querySelector(`[data-pad="${id}"]`));
    },
    [kit],
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
