// דף הבית: פתיחה, קטגוריות, חיפוש (קבוצה, נבחרת, מותג, סוג, שנה, צבע, קוד), סינון וכל המוצרים.
// category = קטגוריה מהכתובת (#/c/<id>), ריק = הכול
import { useMemo, useState } from 'react';
import { ArrowLeft, Search, Shirt, Sparkles, Copy, X } from 'lucide-react';
import { searchShirts } from '../lib/shirt';
import { go } from '../lib/route';
import { Chip, ShirtCard, ShirtImage, TutorialVideo } from './ui';

const SORTS = [
  { id: 'new', label: 'הכי חדשים' },
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

export default function Home({ shirts, categories, loading, favorites, favs, onFav, category = '', initialKind = 'all' }) {
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState('');
  const [kind, setKind] = useState(initialKind);
  const [sort, setSort] = useState('new');

  const current = categories.find((c) => c.id === category);
  const base = (favorites ? shirts.filter((s) => favs.includes(s.id)) : shirts).filter((s) => !category || s.category === category);
  // קבוצות / נבחרות – רק בקטגוריה של חולצות, כשיש בה את שני הסוגים
  const showKinds = current && current.template !== 'plain' && new Set(base.map((s) => s.kind)).size > 1;
  const leagues = useMemo(() => {
    const count = {};
    for (const s of base) if (s.league && (kind === 'all' || s.kind === kind)) count[s.league] = (count[s.league] || 0) + 1;
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ name, he: base.find((s) => s.league === name)?.leagueHe || name }));
  }, [base, kind]);
  const list = sortShirts(searchShirts(base, query, { kind: showKinds ? kind : 'all', league }), sort);
  const showHero = !favorites && !category && !query && !league;

  return (
    <div>
      {showHero && <Hero count={shirts.length} categories={categories} />}
      <div className="mx-auto max-w-6xl px-4">
        <div id="catalog" className={showHero ? 'relative z-10 -mt-7 scroll-mt-24' : 'pt-6'}>
          {!showHero && <h1 className="mb-4 text-2xl font-black">{favorites ? 'המועדפים שלי' : current ? current.name : 'כל המוצרים'}</h1>}
          <div className="relative">
            <Search size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש: קבוצה, נבחרת, מותג, שנה, צבע או קוד"
              className="w-full rounded-2xl border border-line bg-card py-4 pl-12 pr-12 text-base shadow-lg outline-none focus:border-lime-ink"
              aria-label="חיפוש מוצרים"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-soft" aria-label="ניקוי החיפוש">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {!favorites && categories.length > 1 && (
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={!category} onClick={() => go('')}>הכול</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => go(`c/${c.id}`)}>{c.name}</Chip>
            ))}
          </div>
        )}
        {(showKinds || leagues.length > 1) && (
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {showKinds && (
              <>
                <Chip small active={kind === 'all'} onClick={() => setKind('all')}>כולן</Chip>
                <Chip small active={kind === 'club'} onClick={() => setKind('club')}>קבוצות</Chip>
                <Chip small active={kind === 'national'} onClick={() => setKind('national')}>נבחרות</Chip>
              </>
            )}
            {showKinds && leagues.length > 1 && <span className="mx-1 w-px shrink-0 bg-line" />}
            {leagues.length > 1 &&
              leagues.map((l) => (
                <Chip small key={l.name} active={league === l.name} onClick={() => setLeague(league === l.name ? '' : l.name)}>
                  {l.he}
                </Chip>
              ))}
          </div>
        )}

        {showHero && categories.length > 1 && <CategoryTiles categories={categories} shirts={shirts} />}

        <div className="mb-3 mt-5 flex items-center justify-between gap-3 text-sm text-muted">
          <span>{loading ? 'טוען…' : `${list.length} מוצרים`}</span>
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
            {favorites ? 'עוד לא סימנתם מוצרים. לחצו על ♡ במוצר שאהבתם.' : 'לא מצאנו מוצר כזה. נסו מילה אחרת.'}
          </div>
        )}

        {showHero && <Steps />}
      </div>
    </div>
  );
}

function Hero({ count, categories }) {
  const others = categories.filter((c) => c.template === 'plain').map((c) => c.name);
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      {/* תמונת החנות ברקע: בטלפון חיתוך לאורך (השלט והבובה למעלה), במחשב התמונה המלאה */}
      <picture>
        <source media="(min-width: 1024px)" srcSet="hero-lg.webp" />
        <img
          src="hero-sm.webp"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-top lg:object-[30%_50%]"
        />
      </picture>
      {/* שכבה כהה רק מאחורי הכיתוב: בטלפון החלק העליון שקוף (רואים את החנות) והכיתוב למטה על רקע כהה,
          במחשב כהה בצד של הכיתוב (ימין) ושקופה בצד של התמונה */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-15% via-ink/75 via-50% to-ink/95 lg:bg-gradient-to-l lg:from-ink/90 lg:from-0% lg:via-ink/55 lg:via-45% lg:to-transparent" />
      {/* מעבר רך לתחתית, מאחורי שורת החיפוש */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-20 pt-48 lg:min-h-[30rem] lg:grid-cols-2 lg:pb-28 lg:pt-20">
        <div>
          <span className="inline-block rounded-full border border-lime/50 bg-ink/60 px-3 py-1 text-xs font-bold text-lime backdrop-blur-sm">
            {count > 0 ? `${count} מוצרים באתר` : 'הקולקציה מתעדכנת'}
          </span>
          <h1 className="mt-4 text-4xl font-black leading-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.85)] lg:text-6xl">
            החולצה שלך.
            <br />
            <span className="text-lime">השם שלך.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
            חולצות וגופיות של הקבוצות והנבחרות הגדולות בעולם – עם השם, המספר והפאץ' שתבחרו.
            {others.length > 0 && ` וגם ${others.join(', ').replace(/, ([^,]*)$/, ' ו$1')}.`}
          </p>
          <button
            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 font-bold text-ink hover:brightness-95"
          >
            לכל המוצרים <ArrowLeft size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { icon: Shirt, title: 'בוחרים מוצר', text: 'מחפשים לפי קבוצה, נבחרת, מותג, עונה או צבע.' },
    { icon: Sparkles, title: 'מתאימים אישית', text: 'בחולצות: שם, מספר, פאץ\' ואורך שרוול – הכול אופציונלי.' },
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
          <span className="text-sm text-muted">סרטון: איך מזמינים (דקה וחצי)</span>
        </div>
      </div>
    </section>
  );
}

// אריחי הקטגוריות בדף הבית (עם התמונה של המוצר הכי חדש בכל אחת)
function CategoryTiles({ categories, shirts }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
      {categories.map((c) => {
        const items = shirts.filter((s) => s.category === c.id);
        const cover = items.find((s) => s.images?.length);
        return (
          <a key={c.id} href={`#/c/${c.id}`} className="group relative overflow-hidden rounded-2xl bg-ink text-white ring-1 ring-line">
            {cover ? (
              <ShirtImage shirt={cover} className="aspect-[4/3] w-full opacity-90 transition duration-300 group-hover:scale-105" />
            ) : (
              <div className="aspect-[4/3] w-full bg-ink-2" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
              <div className="text-lg font-black leading-tight">{c.name}</div>
              <div className="text-xs text-white/70">{items.length ? `${items.length} מוצרים` : 'בקרוב'}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
