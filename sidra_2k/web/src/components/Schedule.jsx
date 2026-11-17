// לוח 7 המשחקים: מי ניצח, תוצאה, איפה נערך, והמשחק הבא מסומן
import Logo from './Logo';
import { HOME, TEAM, champion, gameDate } from '../lib/series';

export default function Schedule({ games }) {
  const ch = champion(games);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black">לוח המשחקים</h2>
        <small className="text-sm text-muted">2-2-1-1-1 · יתרון ביתיות ללוס אנג'לס</small>
      </div>
      <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">
        {HOME.map((home, i) => {
          const g = games[i];
          const next = !ch && i === games.length;
          const skip = ch && i >= games.length;
          const cls = g ? `won-${g.winner}` : next ? 'border-2 border-dashed border-live bg-card' : 'border-line bg-card';
          return (
            <div key={i} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center ${cls} ${skip ? 'opacity-30' : ''}`}>
              <div className={`num text-xs tracking-[.12em] ${next ? 'text-live' : g ? 'opacity-70' : 'text-muted'}`}>GAME {i + 1}</div>
              <Logo team={g ? g.winner : home} className="h-10 w-10" />
              {g ? (
                <>
                  <div className={`badge-${g.winner} rounded px-1.5 py-0.5 text-[11px] font-extrabold`}>{TEAM[g.winner].name}</div>
                  {g.lal != null && g.sas != null && <div className="num text-sm">{g.winner === 'LAL' ? `${g.lal}–${g.sas}` : `${g.sas}–${g.lal}`}</div>}
                  {g.at > 0 && <div className="text-[10px] opacity-60">{gameDate(g.at)}</div>}
                </>
              ) : (
                <div className="text-[11px] font-semibold text-muted">ב{TEAM[home].city}</div>
              )}
              {!g && i >= 4 && !skip && <div className="text-[10px] text-muted">אם צריך</div>}
              {skip && <div className="text-[10px] text-muted">לא נדרש</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
