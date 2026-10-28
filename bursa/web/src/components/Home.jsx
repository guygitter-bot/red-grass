// מסך הבית: חיפוש, מצב השוק, תחזית, הזדמנויות וסיכום התיק. מתרענן כל 30 שניות
import { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { fmtILS, fmtPrice, fmtSigned, timeAgo, tone } from '../lib/format';
import { useDebounced, useLive } from '../lib/hooks';
import { neededSymbols, valueHoldings } from '../lib/portfolio';
import { stockLink } from '../lib/route';
import { Card, Change, ErrorBox, LiveDot, Num, ScoreBadge, SectionTitle, Spark, Spinner, VerdictBadge } from './ui';

const MOODS = {
  bullish: { label: 'שוק שורי (אופטימי)', emoji: '🐂', cls: 'border-up/50 bg-up-soft' },
  neutral: { label: 'שוק מעורב', emoji: '⚖️', cls: 'border-line bg-card' },
  bearish: { label: 'שוק דובי (זהיר)', emoji: '🐻', cls: 'border-down/50 bg-down-soft' },
};

function SearchBox() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!dq) {
      setResults(null);
      return undefined;
    }
    let alive = true;
    api('/search', { q: dq })
      .then((r) => {
        if (alive) setResults(r.results);
      })
      .catch(() => {
        if (alive) setResults([]);
      });
    return () => {
      alive = false;
    };
  }, [dq]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 focus-within:border-accent">
        <Search size={18} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש מניה: Apple, טבע, TSLA..."
          aria-label="חיפוש מניה"
          className="min-h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
        />
        {q && <button type="button" aria-label="ניקוי" onClick={() => setQ('')} className="text-muted"><X size={18} /></button>}
      </div>
      {results && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-line bg-card shadow-lg">
          {results.length === 0 && <p className="p-4 text-center text-sm text-muted">{dq === q.trim() ? 'לא נמצאו תוצאות' : 'מחפש...'}</p>}
          {results.map((r) => (
            <a key={r.symbol} href={stockLink(r.symbol)} onClick={() => setQ('')} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-soft">
              <span className="min-w-0">
                <span className="block truncate font-medium"><bdi>{r.name}</bdi></span>
                <span className="block text-xs text-muted">{[r.exchange, r.type].filter(Boolean).join(' · ')}</span>
              </span>
              <Num className="shrink-0 rounded-lg bg-soft px-2 py-0.5 text-sm font-bold text-accent-ink">{r.symbol}</Num>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ open, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${open ? 'border-up/40 bg-up-soft text-up' : 'border-line bg-card text-muted'}`}>
      <span className={`h-2 w-2 rounded-full ${open ? 'bg-up' : 'bg-muted'}`} /> {label} {open ? 'פתוחה' : 'סגורה'}
    </span>
  );
}

function List({ title, items, empty }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {items.length === 0 && <p className="p-4 text-center text-sm text-muted">{empty}</p>}
        {items.map((s) => (
          <a key={s.symbol} href={stockLink(s.symbol)} className="flex items-center gap-3 px-4 py-3 hover:bg-soft">
            <ScoreBadge score={s.score} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium"><bdi>{s.name || s.symbol}</bdi></span>
                <Num className="text-xs text-muted">{s.symbol}</Num>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">{s.reasons?.[0]?.text}</span>
            </span>
            <VerdictBadge verdict={s.verdict} />
          </a>
        ))}
      </Card>
    </div>
  );
}

function Bullets({ title, items, mark }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-sm font-bold">{title}</div>
      <ul className="space-y-1 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2"><span aria-hidden="true">{mark}</span><span>{x}</span></li>
        ))}
      </ul>
    </div>
  );
}

function Outlook({ outlook }) {
  if (!outlook) return <Card className="text-center text-sm text-muted">התחזית תופיע בקרוב</Card>;
  const m = MOODS[outlook.mood] || MOODS.neutral;
  return (
    <div className={`rounded-2xl border p-4 ${m.cls}`}>
      <div className="flex items-center gap-2 text-sm font-bold"><span className="text-xl">{m.emoji}</span> {m.label}</div>
      <h3 className="mt-2 text-lg font-bold leading-snug">{outlook.headline}</h3>
      <p className="mt-1 text-sm leading-relaxed">{outlook.summary}</p>
      <Bullets title="מה מניע את השוק" items={outlook.drivers} mark="🔹" />
      <Bullets title="סיכונים" items={outlook.risks} mark="⚠️" />
      <Bullets title="מה כדאי לעקוב אחריו" items={outlook.watch} mark="👀" />
      <p className="mt-3 text-xs text-muted">עודכן {timeAgo(outlook.t)}</p>
    </div>
  );
}

function PortfolioSummary({ summary }) {
  if (!summary) return null;
  if (!summary.count) {
    return (
      <Card>
        <h3 className="font-bold">התיק שלי</h3>
        <p className="mt-1 text-sm text-muted">עוד אין מניות בתיק. פתחו מניה ולחצו "קניתי" כדי לעקוב אחרי הרווח.</p>
      </Card>
    );
  }
  return (
    <a href="#/portfolio" className="block">
      <Card className="hover:bg-soft">
        <div className="flex items-center justify-between"><h3 className="font-bold">התיק שלי</h3><span className="text-xs text-muted">{summary.count} מניות</span></div>
        <Num className="mt-1 block text-2xl font-bold">{fmtILS(summary.value)}</Num>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div><div className="text-xs text-muted">היום</div><Num className={`font-medium ${tone(summary.day)}`}>{fmtSigned(summary.day)}</Num></div>
          <div><div className="text-xs text-muted">רווח כולל</div><Num className={`font-medium ${tone(summary.gain)}`}>{fmtSigned(summary.gain)}</Num></div>
        </div>
      </Card>
    </a>
  );
}

export default function Home() {
  const [home, setHome] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const h = await api('/home');
      setHome(h);
      setError('');
    } catch (e) {
      setError(e.message);
    }
    try {
      const d = await api('/data');
      if (!d.holdings.length) return setSummary({ count: 0 });
      const { quotes } = await api('/quotes', { symbols: neededSymbols([d.holdings]) });
      const v = valueHoldings(d.holdings, quotes);
      setSummary({ count: d.holdings.length, value: v.value, day: v.day, gain: v.gain });
    } catch {
      // סיכום התיק הוא בונוס – לא מציגים שגיאה
    }
  }, []);
  useLive(load, 30000);

  return (
    <div className="space-y-4">
      <SearchBox />
      {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
      {!home && !error && <Spinner />}
      {home && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <LiveDot />
            <Chip open={home.open?.us} label="ניו יורק" />
            <Chip open={home.open?.ta} label='ת"א' />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div>
                <SectionTitle>מצב השוק</SectionTitle>
                {/* בטלפון – רצועה שגוללים לצד, כדי שההמלצות והתחזית לא יירדו לתחתית */}
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible xl:grid-cols-4">
                  {home.indices.map((i) => (
                    <a key={i.symbol} href={stockLink(i.symbol)} className="block w-36 shrink-0 rounded-2xl border border-line bg-card p-3 hover:bg-soft sm:w-auto">
                      <div className="truncate text-xs text-muted">{i.emoji} {i.name}</div>
                      <div className="mt-1 flex items-end justify-between gap-1">
                        <div>
                          <Num className="block text-base font-bold">{fmtPrice(i.price)}</Num>
                          <Change value={i.change} className="text-sm" />
                        </div>
                        <Spark values={i.spark} width={56} height={26} />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <SectionTitle>תחזית השוק</SectionTitle>
                <Outlook outlook={home.outlook} />
              </div>
            </div>
            <div className="space-y-4">
              <PortfolioSummary summary={summary} />
              <List title="הזדמנויות עכשיו" items={home.buys} empty="אין כרגע אותות קנייה חזקים" />
              <List title="כדאי להיזהר" items={home.sells} empty="אין כרגע אותות מכירה" />
              <p className="text-center text-xs text-muted">נסרקו {home.scanned} מניות. האותות הם כלי עזר, לא ייעוץ.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
