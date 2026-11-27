// הלוח הגדול: שתי הקבוצות, תוצאת הסדרה באמצע והשורה המתגלגלת מתחת – כמו בשידור.
// מימין הקבוצה עם יתרון הביתיות (teams[0]).
import Logo from './Logo';
import { TEAM, champion, headline, wins } from '../lib/series';

// צבע השם והמספר של כל קבוצה
export const ACCENT = { LAL: 'text-gold', SAS: 'text-sil', SAC: 'text-sil' };

function Team({ team, era, n, player, lose }) {
  return (
    <div className={`team team-${team} ${lose ? 'team-lose' : ''} flex flex-col items-center gap-2 px-2 pt-4 pb-3.5 text-center text-white lg:gap-3 lg:px-4 lg:pt-6 lg:pb-5`}>
      <Logo team={team} className="logo-shadow relative z-10 aspect-square w-[min(150px,28vw)]" />
      <div className="relative z-10 text-[11px] font-semibold opacity-85 lg:text-sm">
        {TEAM[team].city}
        {era ? ` · ${era}` : ''}
      </div>
      <div className={`relative z-10 text-[clamp(20px,4.6vw,34px)] leading-none font-black italic ${ACCENT[team]}`}>{TEAM[team].name}</div>
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
  const w = wins(series);
  const ch = champion(series);
  const h = headline(series);
  const [a, b] = series.teams;
  const num = (t) => (
    <b key={`${t}${w[t]}`} className={`${ACCENT[t]} ${popped === t ? 'pop' : ''}`}>
      {w[t]}
    </b>
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-line shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)]">
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <Team team={a} era={series.era} n={w[a]} player={series.players[a]} lose={ch === b} />
        <div className="mid flex min-w-0 flex-col items-center justify-center gap-1 border-x border-[#232a3d] px-[clamp(10px,3vw,32px)] py-4 text-white">
          <div className="text-[11px] font-extrabold tracking-[.2em] text-[#8e97b0]">סדרה</div>
          <div className="num flex items-center gap-[.18em] text-[clamp(48px,12vw,108px)] leading-none font-bold">
            {num(a)}
            <span className="text-[#232a3d]">–</span>
            {num(b)}
          </div>
          <div className="num text-xs tracking-[.2em] text-[#8e97b0]">{series.games.length} / 7</div>
        </div>
        <Team team={b} era={series.era} n={w[b]} player={series.players[b]} lose={ch === a} />
      </div>
      <div className={`ticker-${h.tone} px-3 py-2.5 text-center text-[clamp(15px,3.6vw,20px)] font-black`}>{h.text}</div>
    </section>
  );
}
