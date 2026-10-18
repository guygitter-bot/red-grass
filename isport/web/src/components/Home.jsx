// דף הבית: פתיחה, חיפוש (קבוצה, נבחרת, סוג, שנה, צבע, קוד), סינון לפי ליגה וכל החולצות
import { useMemo, useState } from 'react';
import { ArrowLeft, Search, Shirt, Sparkles, Copy, X } from 'lucide-react';
import { searchShirts } from '../lib/shirt';
import { go } from '../lib/route';
import { Chip, ShirtCard, TutorialVideo } from './ui';

const SORTS = [
  { id: 'new', label: 'הכי חדשות' },
  { id: 'year', label: 'לפי עונה' },
  { id: 'name', label: 'לפי שם' },
];

function sortShirts(list, sort) {
  const out = [...list];
  if (sort === 'name') out.sort((a, b) => (a.teamHe || a.team).localeCompare(b.teamHe || b.team, 'he'));
  if (sort === 'year') out.sort((a, b) => String(b.year).localeCompare(String(a.year)));
  if (sort === 'new') out.sort((a, b) => Number(b.featured) - Number(a.featured));
  return out;
}

export default function Home({ shirts, loading, favorites, favs, onFav, kind }) {
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState('');
  const [sort, setSort] = useState('new');

  const base = favorites ? shirts.filter((s) => favs.includes(s.id)) : shirts;
  const leagues = useMemo(() => {
    const count = {};
    for (const s of base) if (s.league && (kind === 'all' || s.kind === kind)) count[s.league] = (count[s.league] || 0) + 1;
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ name, he: base.find((s) => s.league === name)?.leagueHe || name }));
  }, [base, kind]);
  const list = sortShirts(searchShirts(base, query, { kind, league }), sort);
  const showHero = !favorites && kind === 'all' && !query && !league;

  return (
    <div>
      {showHero && <Hero count={shirts.length} />}
      <div className="mx-auto max-w-6xl px-4">
        <div id="catalog" className={showHero ? 'relative z-10 -mt-7 scroll-mt-24' : 'pt-6'}>
          {!showHero && (
            <h1 className="mb-4 text-2xl font-black">
              {favorites ? 'המועדפים שלי' : kind === 'club' ? 'חולצות קבוצות' : kind === 'national' ? 'חולצות נבחרות' : 'כל החולצות'}
            </h1>
          )}
          <div className="relative">
            <Search size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש: קבוצה, נבחרת, בית/חוץ, שנה, צבע או קוד מוצר"
              className="w-full rounded-2xl border border-line bg-card py-4 pl-12 pr-12 text-base shadow-lg outline-none focus:border-lime-ink"
              aria-label="חיפוש חולצות"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-soft" aria-label="ניקוי החיפוש">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {!favorites && (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={kind === 'all'} onClick={() => go('')}>הכול</Chip>
            <Chip active={kind === 'club'} onClick={() => go('club')}>קבוצות</Chip>
            <Chip active={kind === 'national'} onClick={() => go('national')}>נבחרות</Chip>
            {leagues.length > 1 && <span className="mx-1 w-px shrink-0 bg-line" />}
            {leagues.length > 1 &&
              leagues.map((l) => (
                <Chip key={l.name} active={league === l.name} onClick={() => setLeague(league === l.name ? '' : l.name)}>
                  {l.he}
                </Chip>
              ))}
          </div>
        )}

        <div className="mb-3 mt-5 flex items-center justify-between gap-3 text-sm text-muted">
          <span>{loading ? 'טוען חולצות…' : `${list.length} חולצות`}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1.5 text-text" aria-label="מיון">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-soft" />
            ))}
          </div>
        ) : list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
            {list.map((s) => (
              <ShirtCard key={s.id} shirt={s} fav={favs.includes(s.id)} onFav={() => onFav(s.id)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-10 text-center text-muted">
            {favorites ? 'עוד לא סימנתם חולצות. לחצו על ♡ בחולצה שאהבתם.' : 'לא מצאנו חולצה כזאת. נסו מילה אחרת.'}
          </div>
        )}

        {showHero && <Steps />}
      </div>
    </div>
  );
}

function Hero({ count }) {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* פסים אלכסוניים ברקע – כמו מגרש */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(115deg, #c4f43a 0 2px, transparent 2px 46px)' }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-16 pt-10 lg:grid-cols-2 lg:pb-24 lg:pt-16">
        <div>
          <span className="inline-block rounded-full border border-lime/40 px-3 py-1 text-xs font-bold text-lime">
            {count > 0 ? `${count} חולצות באתר` : 'הקולקציה מתעדכנת'}
          </span>
          <h1 className="mt-4 text-4xl font-black leading-tight lg:text-6xl">
            החולצה שלך.
            <br />
            <span className="text-lime">השם שלך.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/70">
            חולצות של הקבוצות והנבחרות הגדולות בעולם – עם השם, המספר והפאץ' שתבחרו.
          </p>
          <button
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 font-bold text-ink hover:brightness-95"
          >
            לכל החולצות <ArrowLeft size={18} />
          </button>
        </div>
        <div className="hidden justify-center lg:flex">
          <BigShirt />
        </div>
      </div>
    </section>
  );
}

// החולצה הגדולה בפתיחה (במחשב)
function BigShirt() {
  return (
    <svg viewBox="0 0 64 64" className="h-72 w-72 drop-shadow-[0_20px_40px_rgba(196,244,58,0.25)]" aria-hidden="true">
      <path d="M24 10 L13 14.5 L6 26 L13.5 31 L17 27 L17 54 L47 54 L47 27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 13.5 35.5 15.5 32 15.5 C28.5 15.5 25.5 13.5 24 10 Z" fill="#c4f43a" />
      <text x="32" y="25" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize="5" fill="#0c0d0f">ISPORT</text>
      <text x="32" y="45" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize="17" fill="#0c0d0f">10</text>
    </svg>
  );
}

function Steps() {
  const steps = [
    { icon: Shirt, title: 'בוחרים חולצה', text: 'מחפשים לפי קבוצה, נבחרת, עונה או צבע.' },
    { icon: Sparkles, title: 'מתאימים אישית', text: 'שם, מספר, פאץ\' ואורך שרוול – הכול אופציונלי.' },
    { icon: Copy, title: 'ממשיכים להזמנה', text: 'ההערה למוכר מועתקת, ובוחרים מידה באתר ההזמנה.' },
  ];
  return (
    <section className="mt-16">
      <h2 className="mb-5 text-center text-2xl font-black">איך זה עובד?</h2>
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl bg-card p-5 ring-1 ring-line">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-lime">
                  <s.icon size={20} />
                </span>
                <span className="text-sm font-bold text-muted">שלב {i + 1}</span>
              </div>
              <div className="text-lg font-extrabold">{s.title}</div>
              <p className="mt-1 text-muted">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <TutorialVideo name="order" />
          <span className="text-sm text-muted">סרטון: איך מזמינים חולצה (דקה)</span>
        </div>
      </div>
    </section>
  );
}
