// הלוח הגדול: שתי הקבוצות, תוצאת הסדרה באמצע והשורה המתגלגלת מתחת – כמו בשידור
import Logo from './Logo';
import { TEAM, champion, headline, wins } from '../lib/series';

function Team({ team, n, player, lose }) {
  const nameColor = team === 'LAL' ? 'text-gold' : 'text-sil';
  return (
    <div className={`team team-${team} ${lose ? 'team-lose' : ''} flex flex-col items-center gap-2 px-2 pt-4 pb-3.5 text-center text-white lg:gap-3 lg:px-4 lg:pt-6 lg:pb-5`}>
      <Logo team={team} className="logo-shadow relative z-10 aspect-square w-[min(150px,28vw)]" />
      <div className="relative z-10 text-[11px] font-semibold opacity-85 lg:text-sm">{TEAM[team].city} · 2010</div>
      <div className={`relative z-10 text-[clamp(20px,4.6vw,34px)] leading-none font-black italic ${nameColor}`}>{TEAM[team].name}</div>
      <div className="relative z-10 flex gap-1.5" aria-label={`${n} ניצחונות`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={`dot ${i < n ? `dot-${team}` : ''}`} />
        ))}
      </div>
      {player && <div className="relative z-10 rounded-full bg-black/35 px-3 py-1 text-sm font-extrabold">🎮 {player}</div>}
    </div>
  );
}

export default function Board({ series, popped }) {
  const w = wins(series.games);
  const ch = champion(series.games);
  const h = headline(series.games);
  return (
    <section className="overflow-hidden rounded-2xl border border-line shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)]">
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <Team team="LAL" n={w.LAL} player={series.players.LAL} lose={ch === 'SAS'} />
        <div className="mid flex min-w-0 flex-col items-center justify-center gap-1 border-x border-[#232a3d] px-[clamp(10px,3vw,32px)] py-4 text-white">
          <div className="text-[11px] font-extrabold tracking-[.2em] text-[#8e97b0]">סדרה</div>
          <div className="num flex items-center gap-[.18em] text-[clamp(48px,12vw,108px)] leading-none font-bold">
            <b key={`l${w.LAL}`} className={`text-gold ${popped === 'LAL' ? 'pop' : ''}`}>
              {w.LAL}
            </b>
            <span className="text-[#232a3d]">–</span>
            <b key={`s${w.SAS}`} className={`text-sil ${popped === 'SAS' ? 'pop' : ''}`}>
              {w.SAS}
            </b>
          </div>
          <div className="num text-xs tracking-[.2em] text-[#8e97b0]">{series.games.length} / 7</div>
        </div>
        <Team team="SAS" n={w.SAS} player={series.players.SAS} lose={ch === 'LAL'} />
      </div>
      <div className={`ticker-${h.tone} px-3 py-2.5 text-center text-[clamp(15px,3.6vw,20px)] font-black`}>{h.text}</div>
    </section>
  );
}
