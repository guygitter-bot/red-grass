// טבלת האלופים (כמה סדרות ניצח כל אחד) והסדרות הקודמות – במחשב בעמודה בצד, בטלפון מתחת ללוח
import Logo from './Logo';
import { TEAM, other, score as fmt, titles } from '../lib/series';

function Past({ h }) {
  const [a, b] = h.teams;
  const name = h.winnerName || (h.winner && h.players?.[h.winner]) || '';
  const score = h.score && h.winner ? fmt(h.score[h.winner], h.score[other(h.teams, h.winner)]) : '';
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-line bg-page px-2.5 py-2">
      <div className="flex shrink-0 -space-x-2 space-x-reverse">
        <Logo team={a} className="h-8 w-8" />
        <Logo team={b} className="h-8 w-8" />
      </div>
      <div className="min-w-0 text-sm">
        <div className="font-bold">
          {TEAM[a].name} נגד {TEAM[b].name}
          {h.era ? <span className="font-normal text-muted"> · {h.era}</span> : null}
        </div>
        <div className="text-muted">
          🏆 {name || (h.winner ? TEAM[h.winner].short : '—')}
          {h.winner && name ? ` (${TEAM[h.winner].name})` : ''}
          {score && <span className="num"> · {score}</span>}
        </div>
      </div>
    </li>
  );
}

export default function Titles({ history }) {
  const table = titles(history);
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg font-black">🏆 טבלת האלופים</h2>
      {table.length ? (
        <div className="flex flex-wrap gap-2">
          {table.map(({ name, n }) => (
            <div key={name} className="flex items-center gap-2 rounded-full border border-gold/60 bg-gold/15 px-3 py-1.5">
              <span className="font-extrabold">{name}</span>
              <span className="num rounded-full bg-gold px-2 text-sm font-bold text-[#1b0d2e]">{n}</span>
              <span className="text-xs text-muted">{n === 1 ? 'סדרה' : 'סדרות'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">עוד אין סדרות שהסתיימו. המנצח הראשון ייכנס לכאן.</p>
      )}
      {history.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-muted">סדרות קודמות</h3>
          <ul className="flex flex-col gap-2">
            {[...history].reverse().map((h, i) => (
              <Past key={`${h.endedAt}-${i}`} h={h} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
