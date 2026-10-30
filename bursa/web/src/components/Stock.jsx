// דף מניה: גרף ותחזית, ציון וסיבות, אינדיקטורים, בדיקה לאחור, דעת AI, חדשות ופעולות
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bell, ExternalLink, MessageCircle, Sparkles, Star, Wallet, Gamepad2 } from 'lucide-react';
import { api } from '../lib/api';
import { currencySymbol, fmtPct, fmtPrice, timeAgo, timeAgoSec } from '../lib/format';
import { toast, useLive } from '../lib/hooks';
import { chatLink, termLink } from '../lib/route';
import { DISCLAIMER } from '../lib/guide';
import Chart from './Chart';
import { AlertSheet, DemoSheet, HoldingSheet } from './StockSheets';
import { Button, Card, Change, ErrorBox, Num, SectionTitle, Spinner, VerdictBadge } from './ui';

const RANGES = [['1m', 'חודש'], ['3m', '3 חודשים'], ['6m', 'חצי שנה'], ['1y', 'שנה'], ['5y', '5 שנים']];
const CONFIDENCE = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה' };
const PROGRESS = ['אוספים נתונים על המניה...', 'קוראים את החדשות האחרונות...', 'מנתחים את המגמה והסיכונים...', 'כותבים סיכום בעברית פשוטה...', 'עוד רגע, הניתוח המעמיק לוקח כחצי דקה...'];

// מד ציון -100..100
function Gauge({ score, verdict, name }) {
  const pos = ((Math.max(-100, Math.min(100, score)) + 100) / 200) * 100;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted">הציון שלנו</div>
          <Num className="text-3xl font-bold">{score > 0 ? `+${score}` : score}</Num>
        </div>
        <VerdictBadge verdict={verdict} label={name} />
      </div>
      <div className="relative mt-3 h-3 rounded-full" style={{ background: 'linear-gradient(to left, var(--color-up), var(--color-line) 50%, var(--color-down))' }} dir="ltr">
        <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-ink bg-card" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted" dir="ltr"><span>מכירה חזקה</span><span>מחכים</span><span>קנייה חזקה</span></div>
    </div>
  );
}

function Indicator({ term, title, value, note }) {
  return (
    <a href={termLink(term)} className="block rounded-xl border border-line bg-page p-3 hover:bg-soft">
      <div className="text-xs text-muted">{title} <span aria-hidden="true">ⓘ</span></div>
      <Num className="mt-0.5 block text-lg font-bold">{value}</Num>
      <div className="mt-0.5 text-xs leading-snug text-muted">{note}</div>
    </a>
  );
}

function Indicators({ a, currency }) {
  const cs = currencySymbol(currency);
  const rsi = a.rsi;
  const rsiNote = rsi == null ? '' : rsi >= 70 ? 'נקנתה הרבה לאחרונה – אולי תתקרר' : rsi <= 30 ? 'נמכרה הרבה – אולי הזדמנות' : 'באזור רגיל';
  const above200 = a.sma200 != null ? a.price > a.sma200 : null;
  const range = a.high52 > a.low52 ? Math.max(0, Math.min(100, ((a.price - a.low52) / (a.high52 - a.low52)) * 100)) : null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Indicator term="RSI" title="RSI" value={rsi ?? '–'} note={rsiNote} />
      <Indicator term="ממוצע 50 / 200" title="ממוצע 50 / 200 יום" value={`${a.sma50 != null ? fmtPrice(a.sma50) : '–'} / ${a.sma200 != null ? fmtPrice(a.sma200) : '–'}`} note={above200 == null ? '' : above200 ? 'המחיר מעל ממוצע 200 – מגמה ארוכה עולה' : 'המחיר מתחת לממוצע 200 – מגמה ארוכה יורדת'} />
      <Indicator term="MACD" title="MACD" value={a.macd ?? '–'} note={a.macd == null ? '' : a.macd > 0 ? 'מומנטום חיובי (המגמה מתחזקת)' : 'מומנטום שלילי (המגמה נחלשת)'} />
      <Indicator term="תנודתיות" title="תנודתיות בשנה" value={a.volatility != null ? `${a.volatility}%` : '–'} note={a.volatility == null ? '' : a.volatility > 45 ? 'מניה "קופצנית" – סיכון גבוה' : a.volatility > 25 ? 'תנודתיות בינונית' : 'מניה יחסית רגועה'} />
      <Indicator term="ירידה מקסימלית (Max Drawdown)" title="ירידה מקסימלית בשנה" value={fmtPct(a.drawdown, 1, false)} note="הנפילה הגדולה ביותר מהשיא בשנה האחרונה" />
      <Indicator term="תמיכה" title="תמיכה / התנגדות" value={`${fmtPrice(a.support)} / ${fmtPrice(a.resistance)}`} note="אזורי מחיר שבהם המניה נעצרה לאחרונה" />
      <div className="col-span-2 rounded-xl border border-line bg-page p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>טווח 52 שבועות</span>{range != null && <span>המחיר ב-<Num>{Math.round(range)}%</Num> מהטווח</span>}</div>
        <div className="relative h-2 rounded-full bg-line" dir="ltr">
          {range != null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent" style={{ left: `${range}%` }} />}
        </div>
        <div className="mt-1 flex justify-between text-xs" dir="ltr"><Num>{cs}{fmtPrice(a.low52)}</Num><Num>{cs}{fmtPrice(a.high52)}</Num></div>
      </div>
    </div>
  );
}

function Changes({ change }) {
  const items = [['d1', 'יום'], ['w1', 'שבוע'], ['m1', 'חודש'], ['m3', '3 חודשים'], ['m6', 'חצי שנה'], ['y1', 'שנה']];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map(([id, label]) => (
        <div key={id} className="rounded-xl bg-page p-2 text-center">
          <div className="text-xs text-muted">{label}</div>
          <Change value={change?.[id]} digits={1} className="text-sm" />
        </div>
      ))}
    </div>
  );
}

function Forecast({ forecast, price, currency }) {
  if (!forecast) return <p className="text-sm text-muted">אין מספיק היסטוריה לתחזית.</p>;
  const cs = currencySymbol(currency);
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {forecast.horizons.map((h) => (
          <div key={h.id} className="rounded-xl border border-line bg-page p-3">
            <div className="text-sm font-bold">{h.name}</div>
            <div className="mt-1 text-xs text-muted">צפוי בערך</div>
            <div className="flex items-baseline gap-2">
              <Num className="text-lg font-bold">{cs}{fmtPrice(h.expected)}</Num>
              <Change value={price ? (h.expected / price - 1) * 100 : null} digits={1} className="text-xs" />
            </div>
            <div className="mt-1 text-xs text-muted">טווח סביר (80%)</div>
            <Num className="text-sm">{cs}{fmtPrice(h.low)} – {cs}{fmtPrice(h.high)}</Num>
            <div className="mt-2 text-xs">סיכוי לעלייה: <Num className="font-bold">{h.probUp}%</Num></div>
            {h.histUp != null && <div className="text-xs text-muted">בעבר עלתה ב-<Num>{h.histUp}%</Num> מהפעמים</div>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">זה לא ניבוי. זה טווח סביר לפי התנודתיות של המניה בעבר: ב-8 מתוך 10 מקרים המחיר אמור להישאר בתוכו.</p>
    </>
  );
}

function Backtest({ bt }) {
  if (!bt) return <p className="text-sm text-muted">אין מספיק היסטוריה לבדיקה לאחור (צריך לפחות שנה וקצת).</p>;
  const better = bt.strategy > bt.buyHold;
  const Row = ({ label, a, b, pct = true }) => (
    <tr className="border-t border-line"><td className="py-1.5 text-muted">{label}</td><td className="py-1.5 text-center font-medium"><Num>{pct ? fmtPct(a) : a}</Num></td><td className="py-1.5 text-center font-medium"><Num>{pct ? fmtPct(b) : b}</Num></td></tr>
  );
  return (
    <>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-muted"><th /><th className="pb-1 font-medium">לפי האותות שלנו</th><th className="pb-1 font-medium">פשוט להחזיק</th></tr></thead>
        <tbody>
          <Row label="תשואה" a={bt.strategy} b={bt.buyHold} />
          <Row label="ירידה מקסימלית" a={bt.strategyDrawdown} b={bt.buyHoldDrawdown} />
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl bg-page p-2"><div className="text-xs text-muted">עסקאות</div><Num className="font-bold">{bt.trades}</Num></div>
        <div className="rounded-xl bg-page p-2"><div className="text-xs text-muted">עסקאות רווחיות</div><Num className="font-bold">{bt.winRate != null ? `${bt.winRate}%` : '–'}</Num></div>
        <div className="rounded-xl bg-page p-2"><div className="text-xs text-muted">אותות קנייה שהצליחו</div><Num className="font-bold">{bt.signalHit != null ? `${bt.signalHit}%` : '–'}</Num></div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">
        אילו קנינו כשהציון עלה מעל +15 ומכרנו כשירד מתחת ל-‎-15 ב-<Num>{bt.years}</Num> השנים האחרונות, היינו מגיעים ל-<Num>{fmtPct(bt.strategy)}</Num> לעומת <Num>{fmtPct(bt.buyHold)}</Num> אם פשוט מחזיקים.{' '}
        {better ? 'במניה הזאת הכללים עבדו טוב יחסית.' : 'במניה הזאת פשוט להחזיק היה עדיף, אז כדאי להתייחס לאותות בזהירות.'}
      </p>
      <p className="mt-1 text-xs text-muted">העבר לא מבטיח את העתיד. הבדיקה כוללת עמלה קטנה על כל עסקה.</p>
    </>
  );
}

function Opinion({ symbol, opinion, setOpinion }) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 8000);
    return () => {
      clearInterval(timer);
    };
  }, [busy]);

  const run = async () => {
    setBusy(true);
    setStep(0);
    setError('');
    try {
      const r = await api('/opinion', { symbol, refresh: true });
      setOpinion(r.opinion);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-accent" /> דעת הבינה המלאכותית</h3>
        {opinion && <span className="text-xs text-muted">{timeAgo(opinion.t)}</span>}
      </div>
      {opinion && !busy && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={opinion.verdict} label={opinion.verdictName} />
            <span className="text-xs text-muted">רמת ביטחון: {CONFIDENCE[opinion.confidence] || opinion.confidence}</span>
          </div>
          <p className="text-sm leading-relaxed">{opinion.summary}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-up-soft p-3">
              <div className="mb-1 text-sm font-bold text-up">בעד</div>
              <ul className="space-y-1 text-sm">{opinion.bull?.map((x, i) => <li key={i} className="flex gap-2"><span aria-hidden="true">+</span><span>{x}</span></li>)}</ul>
            </div>
            <div className="rounded-xl bg-down-soft p-3">
              <div className="mb-1 text-sm font-bold text-down">נגד / סיכונים</div>
              <ul className="space-y-1 text-sm">{opinion.bear?.map((x, i) => <li key={i} className="flex gap-2"><span aria-hidden="true">–</span><span>{x}</span></li>)}</ul>
            </div>
          </div>
          <div className="rounded-xl bg-soft p-3 text-sm"><b>תוכנית מעשית: </b>{opinion.plan}</div>
        </div>
      )}
      {busy && (
        <div className="mt-3 rounded-xl bg-soft p-4 text-center text-sm" role="status">
          <Spinner label={PROGRESS[step]} />
          <p className="text-xs text-muted">זה יכול לקחת עד דקה. אפשר להמשיך לגלול.</p>
        </div>
      )}
      {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}
      <Button variant={opinion ? 'ghost' : 'primary'} busy={busy} onClick={run} className="mt-3 w-full sm:w-auto">{opinion ? 'ניתוח AI עדכני' : 'קבלו דעת AI על המניה'}</Button>
    </Card>
  );
}

export default function Stock({ symbol }) {
  const [range, setRange] = useState('1y');
  const [s, setS] = useState(null);
  const [live, setLive] = useState(null);
  const [fx, setFx] = useState({});
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState('');
  const [opinion, setOpinion] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api('/stock', { symbol, range })
      .then((r) => {
        if (!alive) return;
        if (r.error) throw new Error(r.error);
        setS(r);
        setOpinion(r.opinion);
        setError('');
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [symbol, range]);

  const loadUser = useCallback(async () => {
    setUser(await api('/data'));
  }, []);
  useEffect(() => {
    loadUser().catch(() => {});
  }, [loadUser]);

  // מחיר חי כל 20 שניות
  const refreshQuote = useCallback(async () => {
    const { quotes } = await api('/quotes', { symbols: [symbol, 'ILS=X'] });
    setLive(quotes[symbol]);
    setFx(quotes);
  }, [symbol]);
  useLive(refreshQuote, 20000, [symbol]);

  const watched = user?.watch?.some((w) => w.symbol === symbol);
  const toggleWatch = async () => {
    try {
      const r = await api('/watch', { symbol, remove: !!watched });
      setUser((u) => ({ ...u, watch: r.watch }));
      toast(watched ? 'הוסר מהמעקב' : 'נוסף למעקב');
    } catch (e) {
      toast(e.message);
    }
  };

  // רשימת הקניות: פריט במעקב עם plan === 'buy' (רשומות ישנות בלי plan = מעקב רגיל)
  const inBuy = user?.watch?.some((w) => w.symbol === symbol && w.plan === 'buy');
  const toggleBuy = async () => {
    try {
      const r = await api('/watch', { symbol, plan: inBuy ? null : 'buy' });
      setUser((u) => ({ ...u, watch: r.watch }));
      toast(inBuy ? 'הוסרה מרשימת הקניות' : 'נוספה לרשימת הקניות');
    } catch (e) {
      toast(e.message);
    }
  };

  if (error && !s) {
    return (
      <div className="space-y-3">
        <a href="#/" className="inline-flex items-center gap-1 text-sm text-accent-ink"><ArrowRight size={16} /> חזרה</a>
        <ErrorBox onRetry={() => setRange((r) => r)}>{error}</ErrorBox>
      </div>
    );
  }
  if (!s) return <Spinner />;

  const q = s.quote;
  const price = live?.price ?? q.price;
  const change = live?.change ?? q.change ?? (q.prevClose ? (q.price / q.prevClose - 1) * 100 : null);
  const cur = q.currency;
  const cs = currencySymbol(cur);
  const a = s.analysis;
  const askText = `מה דעתך על ${q.name || symbol} (${symbol})? כדאי לקנות עכשיו?`;
  const owned = user?.holdings?.filter((h) => h.symbol === symbol) || [];

  return (
    <div className="space-y-4">
      <a href="#/" className="inline-flex items-center gap-1 text-sm text-accent-ink"><ArrowRight size={16} /> חזרה</a>

      <div>
        <h1 className="text-xl font-bold leading-snug lg:text-2xl"><bdi>{q.name || symbol}</bdi></h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted"><Num className="font-bold text-ink">{symbol}</Num>{q.exchange && <span>· {q.exchange}</span>}</div>
        <div className="mt-2 flex items-baseline gap-3">
          <Num className="text-4xl font-bold">{cs}{fmtPrice(price)}</Num>
          <Change value={change} className="text-lg" />
        </div>
        <div className="mt-1 text-xs text-muted">{q.time ? `עדכון אחרון: ${timeAgoSec(q.time)} · ` : ''}הנתונים מ-Yahoo Finance ועשויים להתעכב</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={watched ? 'soft' : 'ghost'} onClick={toggleWatch}><Star size={16} fill={watched ? 'currentColor' : 'none'} /> {watched ? 'במעקב' : 'מעקב'}</Button>
        <Button variant={inBuy ? 'soft' : 'ghost'} onClick={toggleBuy}>🛒 {inBuy ? 'ברשימת הקניות' : 'לרשימת הקניות'}</Button>
        <Button variant="ghost" onClick={() => setSheet('holding')}><Wallet size={16} /> קניתי</Button>
        <Button variant="ghost" onClick={() => setSheet('demo')}><Gamepad2 size={16} /> תיק דמה</Button>
        <Button variant="ghost" onClick={() => setSheet('alert')}><Bell size={16} /> התראת מחיר</Button>
        <a href={chatLink(askText)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90"><MessageCircle size={16} /> שאל את הבוט</a>
      </div>
      {owned.length > 0 && (
        <Card className="text-sm">
          יש לכם בתיק: {owned.map((h) => <span key={h.id} className="me-3"><Num className="font-bold">{h.qty}</Num> מניות בקנייה ב-<Num>{cs}{fmtPrice(h.price)}</Num> (<Change value={(price / h.price - 1) * 100} digits={1} />)</span>)}
        </Card>
      )}

      <Card className="p-3 lg:p-4">
        <div className="mb-2 flex flex-wrap gap-1">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setRange(id)} className={`min-h-9 rounded-lg px-3 text-sm font-medium ${range === id ? 'bg-accent text-on-accent' : 'bg-soft text-muted'}`}>{label}</button>
          ))}
          {loading && <span className="ms-auto self-center text-xs text-muted">טוען...</span>}
        </div>
        <div className={loading ? 'opacity-60' : ''}>
          <Chart candles={s.candles} forecast={s.forecast} currency={cs} />
        </div>
        {s.forecast && <p className="mt-1 text-xs text-muted">האזור המקווקו מימין הוא טווח התחזית לשבוע, חודש ו-3 חודשים (הקו המקווקו הוא התחזית הסבירה).</p>}
      </Card>

      {a ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <Card>
            <Gauge score={a.score} verdict={a.verdict} name={s.verdictName} />
            <ul className="mt-4 space-y-1.5">
              {a.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Num className={`mt-0.5 min-w-9 shrink-0 rounded-md px-1 text-center text-xs font-bold ${r.w > 0 ? 'bg-up-soft text-up' : 'bg-down-soft text-down'}`}>{r.w > 0 ? `+${r.w}` : r.w}</Num>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="mb-2 font-bold">שינוי לפי תקופה</h3>
            <Changes change={a.change} />
            <h3 className="mb-2 mt-4 font-bold">האינדיקטורים</h3>
            <p className="mb-2 text-xs text-muted">לחצו על כל אחד כדי לקרוא מה זה אומר.</p>
            <Indicators a={a} currency={cur} />
          </Card>
        </div>
      ) : (
        <Card className="text-sm text-muted">אין מספיק היסטוריה כדי לנתח את המניה הזאת.</Card>
      )}

      <div>
        <SectionTitle>תחזית</SectionTitle>
        <Card><Forecast forecast={s.forecast} price={q.price} currency={cur} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>{s.backtest ? `בדיקה לאחור – ${s.backtest.years} שנים` : 'בדיקה לאחור'}</SectionTitle>
          <Card><Backtest bt={s.backtest} /></Card>
        </div>
        <div>
          <SectionTitle>חוות דעת</SectionTitle>
          <Opinion symbol={symbol} opinion={opinion} setOpinion={setOpinion} />
        </div>
      </div>

      <div>
        <SectionTitle>חדשות</SectionTitle>
        <Card className="divide-y divide-line p-0">
          {(!s.news || s.news.length === 0) && <p className="p-4 text-center text-sm text-muted">אין חדשות כרגע</p>}
          {s.news?.map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-soft">
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-snug" dir="auto">{n.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{[n.source, timeAgoSec(n.time)].filter(Boolean).join(' · ')}</span>
              </span>
              <ExternalLink size={14} className="mt-1 shrink-0 text-muted" />
            </a>
          ))}
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted">{DISCLAIMER}</p>

      {sheet === 'holding' && <HoldingSheet symbol={symbol} name={q.name} price={price} currency={cur} onClose={() => setSheet('')} onSaved={() => loadUser().catch(() => {})} />}
      {sheet === 'demo' && <DemoSheet symbol={symbol} name={q.name} price={price} currency={cur} demo={user?.demo} quotes={fx} onClose={() => setSheet('')} onDone={(d) => setUser(d)} />}
      {sheet === 'alert' && <AlertSheet symbol={symbol} name={q.name} price={price} currency={cur} onClose={() => setSheet('')} onDone={(palerts) => setUser((u) => ({ ...u, palerts }))} />}
    </div>
  );
}
