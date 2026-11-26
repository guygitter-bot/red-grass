// המשרד התלת־ממדי (three/office3d.js נטען בנפרד – three.js כבד). מעל כל דמות תווית HTML עם התמונה והשם,
// שהיא גם כפתור שפותח שיחה. הסצנה נבנית פעם אחת; הסטטוס מהשרת (team.agents) נדחף אליה בכל רענון.
import { useEffect, useRef, useState } from 'react';
import { hueOf, photoOf } from '../lib/agents';
import { newConversation } from '../lib/convs';

export default function Office3D({ agents, onFail }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef({});
  const engine = useRef(null);
  const [ready, setReady] = useState(false);
  const keys = agents.map((a) => a.key).join(',');

  // בונים את הסצנה פעם אחת (או כשרשימת הבוטים משתנה)
  useEffect(() => {
    let dead = false;
    let eng = null;
    import('../three/office3d.js')
      .then(({ createOffice }) => {
        if (dead || !canvasRef.current) return;
        const list = keys.split(',');
        const hues = Object.fromEntries(list.map((k) => [k, hueOf(k, list.map((key) => ({ key })))]));
        eng = createOffice(canvasRef.current, {
          keys: list,
          hues,
          onPick: (key) => newConversation(key),
          onFrame: () => {
            for (const k of list) {
              const el = labelsRef.current[k];
              const pt = eng?.project(k);
              if (el && pt) el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -100%)`;
            }
          },
        });
        engine.current = eng;
        // לבדיקות: ?debug חושף את המנוע
        if (window.location.search.includes('debug')) window.__office = eng;
        setReady(true);
      })
      .catch(() => onFail?.());
    return () => {
      dead = true;
      eng?.dispose();
      engine.current = null;
    };
  }, [keys, onFail]);

  // סטטוס חדש מהשרת
  useEffect(() => {
    engine.current?.setAgents(agents);
  }, [agents, ready]);

  return (
    <div className="relative h-[72dvh] min-h-[420px] w-full overflow-hidden lg:h-[calc(100dvh-3rem)]">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="המשרד של הצוות" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">בונה את המשרד…</div>}
      {/* תוויות מעל הדמויות – גם כפתורים לשיחה */}
      <div className="pointer-events-none absolute inset-0" style={{ visibility: ready ? 'visible' : 'hidden' }}>
        {agents.map((a, i) => {
          const hue = hueOf(a.key, agents);
          return (
            <button
              key={a.key}
              ref={(el) => {
                labelsRef.current[a.key] = el;
              }}
              onClick={() => newConversation(a.key)}
              aria-label={`שיחה עם ${a.name}`}
              className="pointer-events-auto absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border py-0.5 pe-2 ps-0.5 text-[11px] font-bold text-white shadow-lg will-change-transform"
              style={{ borderColor: `hsl(${hue} 85% 62%)`, background: 'rgb(8 12 28 / 0.82)', zIndex: 10 + i }}
            >
              <span className="block h-5 w-5 overflow-hidden rounded-full bg-[#141a2e]">
                {photoOf(a.key) ? <img src={photoOf(a.key)} alt="" className="h-full w-full object-cover" /> : <span className="text-xs">{a.emoji}</span>}
              </span>
              {a.name}
              {a.busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${hue} 95% 65%)` }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
