// עיגול עם התמונה של הבוט (או האימוג'י שלו) בתוך טבעת צבעונית. busy = טבעת פועמת
import { hueOf, photoOf } from '../lib/agents';

export default function Avatar({ agent, agents, size = 40, busy = false }) {
  const hue = hueOf(agent.key, agents);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {busy && <span className="pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: `hsl(${hue} 85% 62%)` }} />}
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 bg-card"
        style={{ borderColor: `hsl(${hue} 80% 60%)`, fontSize: size * 0.5, boxShadow: `0 0 ${size / 4}px hsl(${hue} 80% 60% / 0.35)` }}
      >
        {photoOf(agent.key) ? (
          <img src={photoOf(agent.key)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span style={{ lineHeight: 1 }}>{agent.emoji}</span>
        )}
      </span>
    </span>
  );
}
