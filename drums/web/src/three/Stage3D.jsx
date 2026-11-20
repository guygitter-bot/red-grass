// הבמה התלת־ממדית ב-React: קנבס על כל האזור, מגע מרובה (pointerdown לכל אצבע), תוויות "טייפ" על החלקים,
// ושכבת כפתורים נסתרת (data-pad) שדרכה מצב הלימוד מדגיש חלקים ומקבל משוב – כמו בבמה השטוחה (lib/padfx.js).
import { useEffect, useRef, useState } from 'react';
import { PIECES } from '../lib/kit';
import { createStage } from './stage';

function loadLabels() {
  try {
    return localStorage.getItem('mf_labels') !== '0';
  } catch {
    return true;
  }
}

export default function Stage3D({ kit, keys = false, padsRef, onHit, onFail, onEngine }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const kitRef = useRef(kit);
  kitRef.current = kit;
  const hitRef = useRef(onHit);
  hitRef.current = onHit;
  const [anchors, setAnchors] = useState([]);
  const [labels, setLabels] = useState(loadLabels);
  // פרוקסי להדגשות הלימוד: padfx קורא לו דרך האלמנט של שכבת הכפתורים
  const fx = useRef({
    flash: (id, cls) => engineRef.current?.flash(id, cls),
    cues: (now, soon) => engineRef.current?.cues(now, soon),
  });

  useEffect(() => {
    let engine;
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      engine = createStage(canvasRef.current, { quality: q });
    } catch {
      onFail?.();
      return undefined;
    }
    engineRef.current = engine;
    onEngine?.(engine);
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('q')) window.__drumStage = engine;
    const el = wrapRef.current;
    const sync = () => {
      engine.setDark(document.documentElement.classList.contains('dark'));
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      engine.resize(width, height);
      engine.setKit(kitRef.current);
      setAnchors(engine.anchors());
    });
    ro.observe(el);
    const lost = (e) => {
      e.preventDefault();
      onFail?.();
    };
    canvasRef.current.addEventListener('webglcontextlost', lost);
    const canvas = canvasRef.current;
    return () => {
      ro.disconnect();
      mo.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      onEngine?.(null);
      engineRef.current = null;
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // סט חדש (בונה / החלפת סט)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setKit(kit);
    setAnchors(engine.anchors());
  }, [kit]);

  const toggleLabels = () => {
    const v = !labels;
    setLabels(v);
    try {
      localStorage.setItem('mf_labels', v ? '1' : '0');
    } catch {
      // מצב פרטי
    }
  };

  return (
    <div ref={wrapRef} className="stage3d relative flex-1 min-h-0 min-w-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ touchAction: 'none' }}
        aria-label="סט התופים – הקישו על החלקים כדי לנגן"
        role="img"
        onPointerDown={(e) => {
          e.preventDefault();
          const id = engineRef.current?.pick(e.clientX, e.clientY);
          if (id) hitRef.current?.(id);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {labels && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden dir="rtl">
          {anchors.map((a) => {
            const spec = PIECES[a.id];
            if (!spec) return null;
            return (
              <span key={a.id} className="kit-tag" style={{ left: a.x, top: a.y }}>
                {spec.label}
                {keys && <kbd className="key-hint">{spec.hint}</kbd>}
              </span>
            );
          })}
        </div>
      )}
      <button type="button" className="stage-toggle" onClick={toggleLabels} aria-pressed={labels} title="תוויות על החלקים">
        <span className="led" aria-hidden />
        תוויות
      </button>
      {/* שכבת חלקים נסתרת: נגישות + חיבור למצב הלימוד */}
      <div
        className="sr-only"
        dir="rtl"
        ref={(el) => {
          if (padsRef) padsRef.current = el;
          if (el) el.__fx = fx.current;
        }}
      >
        {kit.pieces.map((id) => (
          <button key={id} type="button" tabIndex={-1} data-pad={id} onClick={() => hitRef.current?.(id)}>
            {PIECES[id]?.label}
          </button>
        ))}
      </div>
    </div>
  );
}
