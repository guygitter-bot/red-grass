// לוח הצוות: "המשרד" – קומה במגדל בלילה, משרד גדול למנהל ומשרד לכל בוט.
// במכשיר עם WebGL – משרד תלת־ממדי עם דמויות חיות (Office3D); בלי – הציור השטוח (Office.jsx).
// לחיצה על משרד / דמות פותחת שיחה עם הבוט
import { useCallback, useState } from 'react';
import { Video } from 'lucide-react';
import { findAgent } from '../lib/agents';
import { ils, usd } from '../lib/format';
import { newConversation } from '../lib/convs';
import { Room, Sky, Skyline } from './Office';
import Office3D from './Office3D';

// האם יש WebGL במכשיר
let glOk = null;
function webglOk() {
  if (glOk !== null) return glOk;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    glOk = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    glOk = false;
  }
  return glOk;
}

export default function TeamBoard({ team }) {
  const [use3d, setUse3d] = useState(webglOk);
  const fail = useCallback(() => setUse3d(false), []);
  if (!team) return <p className="p-8 text-center text-muted">רגע…</p>;
  const agents = team.agents;
  const manager = findAgent(agents, 'manager');
  const others = agents.filter((a) => a !== manager);
  // מי הלך למי: בוט שעובד עם from = הבוט שהעביר אליו. ה-from "יושב" אצלו, והמשרד שלו ריק
  const awayAt = Object.fromEntries(agents.filter((a) => a.busy && a.from).map((a) => [a.from, a]));
  const room = (a, big = false) => (
    <Room
      key={a.key}
      agent={a}
      agents={agents}
      big={big}
      visitor={a.busy && a.from ? findAgent(agents, a.from) : null}
      away={!a.busy ? awayAt[a.key] : null}
      onClick={() => newConversation(a.key)}
    />
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-3 pb-8 pt-3 lg:min-h-full lg:max-w-none lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-8 lg:py-6">
      <div className="relative w-full max-w-[680px] shrink-0 overflow-hidden rounded-[1.75rem] border border-line lg:max-w-[1000px] lg:flex-1" style={{ background: 'linear-gradient(180deg, #050816 0%, #0b1433 55%, #16214d 100%)' }}>
        {use3d ? (
          <Office3D agents={agents} onFail={fail} />
        ) : (
        <>
        <Sky />
        <Skyline />
        <div className="relative px-3 pb-4 pt-3 sm:px-5">
          <div className="mb-1 text-center text-xs font-medium tracking-wide text-white/60">🏙️ המשרד · קומה 42</div>
          {manager && (
            <div className="mx-auto w-[78%] sm:w-[56%] lg:w-[34%]">{room(manager, true)}</div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">{others.map((a) => room(a))}</div>
        </div>
        </>
        )}
      </div>

      {/* במחשב: טור לצד הלוח */}
      <div className="flex w-full max-w-[620px] flex-col lg:w-80 lg:max-w-none">
      {manager && (
        <button onClick={() => newConversation(manager.key)} className="mt-5 w-full rounded-2xl bg-accent lg:mt-0 lg:py-5 px-4 py-3.5 text-base font-bold text-white hover:opacity-90">
          {manager.emoji} משימה חדשה למנהל
          <span className="block text-sm font-normal opacity-90">הוא מתכנן, מחלק בין הבוטים ומסכם</span>
        </button>
      )}
      <button
        onClick={() => newConversation(null)}
        className={`mt-3 w-full rounded-2xl lg:py-4 px-4 py-3 font-bold ${manager ? 'border border-line bg-card hover:bg-soft' : 'bg-accent py-3.5 text-base text-white hover:opacity-90'}`}
      >
        שיחה עם כל הצוות
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="num rounded-full border border-line bg-card px-3 py-1.5">
          היום: <b>{ils(team.costs.today, team.costs.ils)}</b> <span className="text-muted">({usd(team.costs.today)})</span>
        </span>
        {team.video === false && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Video size={14} /> עריכת וידאו עוד לא מחוברת
          </span>
        )}
      </div>
      </div>
    </div>
  );
}
