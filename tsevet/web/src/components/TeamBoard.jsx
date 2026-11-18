// לוח הצוות: הבוטים כעיגולים על מעגל, מחוברים בקווים דקים. לחיצה על בוט פותחת שיחה אליו
import { Video } from 'lucide-react';
import { avatarSize, boardLayout } from '../lib/board';
import { hueOf, photoOf } from '../lib/agents';
import { ils, usd } from '../lib/format';
import { newConversation } from '../lib/convs';
import { Spinner } from './ui';

function Node({ agent, agents, pos, size, many, onClick }) {
  const hue = hueOf(agent.key, agents);
  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center text-center"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}%`, transform: 'translate(-50%, -50%)' }}
      aria-label={`שיחה עם ${agent.name}`}
    >
      <span className="relative block w-full" style={{ aspectRatio: '1' }}>
        {agent.busy && <span className="pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: `hsl(${hue} 85% 62%)` }} />}
        <span
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] bg-card"
          style={{ borderColor: `hsl(${hue} 80% 60%)`, boxShadow: `0 0 24px hsl(${hue} 80% 60% / 0.35)`, fontSize: `${size * 0.5}cqw` }}
        >
          {photoOf(agent.key) ? (
            <img src={photoOf(agent.key)} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <span style={{ lineHeight: 1 }}>{agent.emoji}</span>
          )}
        </span>
        {!agent.busy && <span className="absolute bottom-[6%] end-[6%] h-[18%] w-[18%] rounded-full border-2 border-card bg-ok" title="פנוי" />}
      </span>
      {/* רקע לשם, כדי שהקווים לא יחתכו את הטקסט */}
      <span className="mt-1 flex w-max max-w-[30cqw] flex-col lg:max-w-[19cqw] items-center rounded-lg bg-card/90 px-1.5 py-0.5">
        <span className={`font-bold leading-tight lg:text-base ${many ? 'text-xs' : 'text-sm'}`}>{agent.name}</span>
        <span className={`text-[11px] leading-tight text-muted lg:line-clamp-2 lg:text-xs ${many ? 'hidden sm:block' : ''}`}>{agent.short}</span>
        {agent.busy && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
            <Spinner size={10} /> עובד…
          </span>
        )}
      </span>
    </button>
  );
}

export default function TeamBoard({ team }) {
  if (!team) return <p className="p-8 text-center text-muted">רגע…</p>;
  const agents = team.agents;
  const n = agents.length;
  // המנהל באמצע, השאר סביבו. מ-4 בוטים – בטלפון רק השם
  const { pos, lines, mid } = boardLayout(agents);
  const size = avatarSize(mid >= 0 ? n - 1 : n);
  const manager = mid >= 0 ? agents[mid] : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-8 pt-4 lg:min-h-full lg:max-w-none lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-8 lg:py-6">
      <div
        className="relative aspect-square w-full max-w-[620px] shrink-0 rounded-[2rem] lg:w-[min(calc(100dvh-3rem),calc(100vw-20rem-26rem))] lg:max-w-[900px] border border-line bg-card"
        style={{ containerType: 'inline-size', backgroundImage: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 65%)' }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map(([a, b]) => {
            const hot = agents[a].busy || agents[b].busy;
            return (
              <line
                key={`${a}-${b}`}
                x1={pos[a].x}
                y1={pos[a].y}
                x2={pos[b].x}
                y2={pos[b].y}
                stroke={hot ? 'var(--color-accent)' : 'var(--color-line)'}
                strokeWidth={hot ? 0.5 : 0.35}
                strokeDasharray={hot ? '1.5 1.5' : undefined}
              />
            );
          })}
        </svg>
        {agents.map((a, i) => (
          <Node key={a.key} agent={a} agents={agents} pos={pos[i]} size={size} many={n > 3} onClick={() => newConversation(a.key)} />
        ))}
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
