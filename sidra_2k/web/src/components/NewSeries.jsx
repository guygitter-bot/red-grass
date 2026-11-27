// סדרה חדשה (רק המאסטר): שתי קבוצות, מי עם יתרון ביתיות, תקופה, ומי משחק בכל קבוצה.
// סדרה שהוכרעה עוברת לטבלת האלופים; סדרה שלא הסתיימה – נמחקת.
import { useState } from 'react';
import Logo from './Logo';
import { TEAM, TEAM_LIST, champion } from '../lib/series';

const btn = 'rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold hover:border-muted disabled:opacity-50';

function TeamPicker({ label, value, onPick }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-bold">{label}</div>
      <div className="flex flex-wrap gap-2">
        {TEAM_LIST.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            aria-pressed={value === t}
            className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-sm font-bold ${value === t ? 'border-gold bg-gold/15' : 'border-line bg-page'}`}
          >
            <Logo team={t} className="h-8 w-8" />
            {TEAM[t].name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewSeries({ series, busy, onStart, onClose }) {
  const [home, setHome] = useState(series.teams[0]);
  const [away, setAway] = useState(series.teams[1]);
  const [era, setEra] = useState(series.era);
  // השמות מהסדרה הקודמת, כדי שטבלת האלופים תספור את אותו אדם תחת אותו שם
  const [names, setNames] = useState({ ...series.players });
  const lost = series.games.length > 0 && !champion(series);

  // בחירה באותה קבוצה בשני הצדדים – מחליפה ביניהם
  const pick = (slot, t) => {
    if (slot === 'home') {
      if (t === away) setAway(home);
      setHome(t);
    } else {
      if (t === home) setHome(away);
      setAway(t);
    }
  };
  const nameRow = (t) => (
    <label key={t} className="grid grid-cols-[auto_1fr] items-center gap-3">
      <Logo team={t} className="h-9 w-9" />
      <input
        id={`new-player-${t}`}
        value={names[t] || ''}
        maxLength={20}
        onChange={(e) => setNames({ ...names, [t]: e.target.value })}
        placeholder={`מי משחק ב${TEAM[t].name}?`}
        className="w-full rounded-lg border border-line bg-page px-3 py-2.5"
      />
    </label>
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gold bg-card p-4">
      <h3 className="text-lg font-black">🏀 סדרה חדשה</h3>
      <TeamPicker label="קבוצה עם יתרון ביתיות (משחקים 1, 2, 5, 7 בבית)" value={home} onPick={(t) => pick('home', t)} />
      <TeamPicker label="הקבוצה השנייה" value={away} onPick={(t) => pick('away', t)} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">תקופה</span>
        <input id="new-era" value={era} maxLength={20} onChange={(e) => setEra(e.target.value)} placeholder="למשל: שנות ה-2000" className="w-full rounded-lg border border-line bg-page px-3 py-2.5" />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">מי משחק באיזו קבוצה? (אפשר גם אחר כך)</span>
        {nameRow(home)}
        {nameRow(away)}
      </div>
      {lost && <div className="rounded-lg border border-live/50 bg-live/10 px-3 py-2 text-sm">הסדרה הנוכחית עוד לא הסתיימה – היא תימחק ולא תיכנס לטבלת האלופים.</div>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className="rounded-lg bg-gold px-4 py-2 font-black text-[#1b0d2e] disabled:opacity-50"
          onClick={() => onStart({ teams: [home, away], era: era.trim(), players: { [home]: (names[home] || '').trim(), [away]: (names[away] || '').trim() } })}
        >
          להתחיל את הסדרה
        </button>
        <button className={btn} onClick={onClose}>
          ביטול
        </button>
      </div>
    </section>
  );
}
