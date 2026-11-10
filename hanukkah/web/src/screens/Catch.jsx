import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { newCatchGame, step, W, H, PLATE_W, PLATE_Y } from '../lib/catch';
import { play } from '../lib/sound';

const EMOJI = { sufganiya: '🍩', coin: '🪙', drop: '💧' };

// ציור המסך על הקנבס (רקע לילה קבוע – זהה בשני המצבים)
function draw(ctx, s) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c1538');
  g.addColorStop(1, '#24376f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 18; i++) ctx.fillRect((i * 97) % W, (i * 53) % (H - 80), 2, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  for (const it of s.items) ctx.fillText(EMOJI[it.type], it.x, it.y);
  // צלחת
  const x = s.plateX;
  ctx.fillStyle = '#ffc23e';
  ctx.beginPath();
  ctx.ellipse(x, PLATE_Y + 18, PLATE_W / 2, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98a1a';
  ctx.beginPath();
  ctx.ellipse(x, PLATE_Y + 16, PLATE_W / 2 - 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export default function Catch() {
  const { progress, update } = useApp();
  const canvasRef = useRef(null);
  const stateRef = useRef(newCatchGame());
  const dirRef = useRef(0);
  const pausedRef = useRef(false);
  const [phase, setPhase] = useState('ready'); // ready | play | over
  const [hud, setHud] = useState({ score: 0, lives: 3 });
  const [paused, setPaused] = useState(false);
  const [final, setFinal] = useState(null);

  const begin = () => {
    stateRef.current = newCatchGame();
    dirRef.current = 0;
    pausedRef.current = false;
    setPaused(false);
    setHud({ score: 0, lives: 3 });
    setPhase('play');
    play('tap');
  };
  const setPause = (v) => {
    pausedRef.current = v;
    setPaused(v);
  };

  // מצייר מסך פתיחה/סיום
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || phase === 'play') return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, stateRef.current);
  }, [phase]);

  // לולאת המשחק
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    let last = performance.now();
    let shown = { score: 0, lives: 3 };

    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!pausedRef.current) {
        const s = step(stateRef.current, dt, dirRef.current);
        stateRef.current = s;
        if (s.events.includes('good')) play('tap');
        if (s.events.includes('bad')) play('wrong');
        if (s.score !== shown.score || s.lives !== shown.lives) {
          shown = { score: s.score, lives: s.lives };
          setHud(shown);
        }
        draw(ctx, s);
        if (s.over) {
          setFinal(s.score);
          setPhase('over');
          update((p) => ({ ...p, catchBest: Math.max(p.catchBest, s.score) }));
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // לשונית שהוסתרה – משהים
    const onVis = () => {
      if (document.hidden) {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    const keys = (down) => (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        dirRef.current = down ? -1 : dirRef.current === -1 ? 0 : dirRef.current;
        e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        dirRef.current = down ? 1 : dirRef.current === 1 ? 0 : dirRef.current;
        e.preventDefault();
      } else if (down && (k === 'p' || k === 'P' || k === 'Escape')) {
        const v = !pausedRef.current;
        pausedRef.current = v;
        setPaused(v);
      }
    };
    const kd = keys(true);
    const ku = keys(false);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      dirRef.current = 0;
    };
  }, [phase]);

  // גרירה באצבע או בעכבר
  const onPointer = (e) => {
    if (phase !== 'play' || pausedRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    stateRef.current = { ...stateRef.current, plateX: Math.max(PLATE_W / 2, Math.min(W - PLATE_W / 2, x)) };
  };
  const hold = (d) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      dirRef.current = d;
    },
    onPointerUp: () => {
      dirRef.current = 0;
    },
    onPointerLeave: () => {
      dirRef.current = 0;
    },
    onPointerCancel: () => {
      dirRef.current = 0;
    },
  });

  return (
    <Layout title="תפוס סופגניות" back="#/games">
      <div className="grid gap-5 lg:grid-cols-2 items-start max-w-4xl mx-auto">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="flex items-center justify-between font-extrabold mb-2 text-lg" aria-live="polite">
            <span>ניקוד: {hud.score}</span>
            <span aria-label={`${hud.lives} חיים`}>{[0, 1, 2].map((i) => (i < hud.lives ? '🕯️' : '💨')).join(' ')}</span>
            <button className="btn btn-sm" disabled={phase !== 'play'} onClick={() => setPause(!paused)}>{paused ? '▶ המשך' : '⏸ השהיה'}</button>
          </div>
          <div className="relative rounded-3xl overflow-hidden border-2 border-line" style={{ aspectRatio: `${W} / ${H}` }}>
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{ touchAction: 'none' }}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              role="img"
              aria-label="משחק תפיסה"
            />
            {phase !== 'play' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white text-center p-5">
                {phase === 'over' ? (
                  <>
                    <div className="text-5xl">🕯️💨</div>
                    <div className="text-2xl font-extrabold">נגמרו החיים! קיבלתם {final}</div>
                    <div>השיא שלכם: {progress.catchBest}</div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl">🍩</div>
                    <div className="text-xl font-extrabold">תפסו סופגניות ומטבעות, ושמרו על הנרות מטיפות מים!</div>
                  </>
                )}
                <button className="btn btn-primary text-xl min-h-14 px-8" onClick={begin}>{phase === 'over' ? 'עוד פעם' : 'התחילו'}</button>
              </div>
            )}
            {paused && phase === 'play' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-2xl font-extrabold">המשחק מושהה</div>
            )}
          </div>
          <div className="flex gap-3 mt-3" dir="ltr">
            <button className="btn flex-1 min-h-16 text-2xl select-none" {...hold(-1)} aria-label="שמאלה" style={{ touchAction: 'none' }}>◀</button>
            <button className="btn flex-1 min-h-16 text-2xl select-none" {...hold(1)} aria-label="ימינה" style={{ touchAction: 'none' }}>▶</button>
          </div>
        </div>

        <div className="card p-5">
          <div className="font-extrabold text-xl mb-2">איך משחקים?</div>
          <ul className="m-0 ps-5 flex flex-col gap-1">
            <li>זזים עם הצלחת ימינה ושמאלה: גוררים עם האצבע או העכבר, לוחצים על החצים, או על המקשים ◀ ▶ במקלדת.</li>
            <li>🍩 סופגניה = נקודה אחת. 🪙 מטבע = שתי נקודות.</li>
            <li>💧 טיפת מים מכבה נר. יש לכם שלושה נרות (חיים).</li>
            <li>ככל שצוברים נקודות, הנפילה מהירה יותר.</li>
            <li>כפתור P במקלדת משהה. המשחק מושהה גם כשעוברים ללשונית אחרת.</li>
          </ul>
          <p className="mb-0 mt-3 text-muted">השיא שלכם: {progress.catchBest}</p>
        </div>
      </div>
    </Layout>
  );
}
