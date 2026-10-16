import { TEAMS, eraLabel, langLabel, ranking } from '../lib/game';
import { Players, Settings, StartButton } from './Lobby';
import { Avatar, Card } from './ui';

const MEDALS = ['🥇', '🥈', '🥉'];

// סוף המשחק: מי ניצח, הדירוג, ומשחק נוסף
export default function Over({ state, act }) {
  const players = ranking(state.players);
  const teams = state.teams ? ranking(state.teams) : null;
  const top = teams ? teams.filter((t) => t.place === 1) : players.filter((p) => p.place === 1);
  const title = teams
    ? top.length > 1
      ? 'תיקו בין הקבוצות!'
      : `${TEAMS[top[0].team].icon} ${TEAMS[top[0].team].name} ניצחו!`
    : top.length > 1
      ? 'תיקו!'
      : `${top[0]?.name} ניצח/ה!`;
  const s = state.settings;
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <Card className="text-center">
          <div className="pop text-6xl">🏆</div>
          <h2 className="mt-2 text-3xl font-extrabold text-accent-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            {state.game.count} שאלות · {langLabel(s.lang)} · {eraLabel(s.era)}
          </p>
          {teams && (
            <div className="mt-4 flex justify-center gap-3">
              {teams.map((t) => (
                <div key={t.team} className={`rounded-2xl px-5 py-3 text-white ${TEAMS[t.team].bg}`}>
                  <div>
                    {MEDALS[t.place - 1]} {TEAMS[t.team].name}
                  </div>
                  <div className="text-3xl font-extrabold">{t.total}</div>
                  <div className="text-xs opacity-80">ממוצע לשחקן/ית</div>
                </div>
              ))}
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-2 text-right">
            {players.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${p.id === state.me ? 'bg-soft' : ''}`}>
                <span className="w-8 text-center text-xl">{MEDALS[p.place - 1] || p.place}</span>
                <Avatar player={p} size={40} />
                <span className="min-w-0 truncate text-lg">{p.name}</span>
                {teams && <span>{TEAMS[p.team].icon}</span>}
                <span className="mr-auto text-sm text-muted">
                  {p.right}/{state.game.count} נכונות
                </span>
                <b className="w-10 text-left text-xl">{p.total}</b>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <StartButton act={act} label="🎵 עוד משחק (שירים אחרים)" />
        <Settings state={state} act={act} />
        {s.mode === 'teams' && <Players state={state} act={act} />}
        {state.error && <Card className="text-center text-bad">{state.error}</Card>}
      </div>
    </div>
  );
}
