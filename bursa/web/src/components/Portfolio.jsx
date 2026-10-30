// התיק: אמיתי, תיק דמה (תרגול) ומעקב + התראות מחיר
import { useCallback, useEffect, useState } from 'react';
import { Bell, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { currencySymbol, fmtILS, fmtPct, fmtPrice, fmtSigned, timeAgo, tone } from '../lib/format';
import { toast, useLive } from '../lib/hooks';
import { DEMO_START, neededSymbols, valueDemo, valueHoldings } from '../lib/portfolio';
import { stockLink } from '../lib/route';
import { DemoSheet, HoldingSheet } from './StockSheets';
import { Button, Card, Change, Empty, ErrorBox, Num, ScoreBadge, SectionTitle, Spinner, Tabs, VerdictBadge } from './ui';

function Totals({ items }) {
  return (
    <Card className="mb-4 grid grid-cols-3 gap-3">
      {items.map(([label, value, cls]) => (
        <div key={label}>
          <div className="text-xs text-muted">{label}</div>
          <Num className={`block text-base font-bold sm:text-xl ${cls || ''}`}>{value}</Num>
        </div>
      ))}
    </Card>
  );
}

function Symbol({ h }) {
  return (
    <a href={stockLink(h.symbol)} className="min-w-0">
      <span className="block truncate font-bold"><bdi>{h.name || h.symbol}</bdi></span>
      <Num className="text-xs text-muted">{h.symbol}</Num>
    </a>
  );
}

function RealTab({ data, quotes, reload, onEdit }) {
  const v = valueHoldings(data.holdings, quotes);
  const remove = async (h) => {
    if (!window.confirm(`למחוק את ${h.name || h.symbol} מהתיק?`)) return;
    try {
      await api('/holding/delete', { id: h.id });
      toast('נמחק מהתיק');
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  if (!data.holdings.length) return <Empty>עוד אין מניות בתיק. פתחו דף מניה ולחצו "קניתי".</Empty>;
  return (
    <>
      <Totals items={[
        ['שווי התיק', fmtILS(v.value)],
        ['היום', fmtSigned(v.day), tone(v.day)],
        ['רווח כולל', `${fmtSigned(v.gain)} (${fmtPct(v.gainPct)})`, tone(v.gain)],
      ]} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {v.rows.map((h) => {
          const cs = currencySymbol(h.currency);
          const sig = data.signals?.[h.symbol];
          return (
            <Card key={h.id}>
              <div className="flex items-start justify-between gap-2">
                <Symbol h={h} />
                {sig && <div className="flex shrink-0 items-center gap-1.5"><ScoreBadge score={sig.score} /><VerdictBadge verdict={sig.verdict} /></div>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
                <div><div className="text-xs text-muted">כמות · קנייה</div><Num>{h.qty} × {cs}{fmtPrice(h.price)}</Num></div>
                <div><div className="text-xs text-muted">עכשיו</div><Num>{cs}{fmtPrice(h.now)}</Num> <Change value={h.change} digits={1} className="text-xs" /></div>
                <div><div className="text-xs text-muted">רווח / הפסד</div><Num className={`font-bold ${tone(h.gain)}`}>{h.gain != null ? `${cs}${fmtPrice(Math.abs(h.gain))}` : '–'}</Num> <Change value={h.gainPct} digits={1} className="text-xs" /></div>
                <div><div className="text-xs text-muted">שווי בשקלים</div><Num className="font-bold">{fmtILS(h.valueILS)}</Num></div>
                {h.stop && <div><div className="text-xs text-muted">סטופ לוס</div><Num>{cs}{fmtPrice(h.stop)}</Num></div>}
                {h.target && <div><div className="text-xs text-muted">יעד</div><Num>{cs}{fmtPrice(h.target)}</Num></div>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" className="min-h-9 flex-1" onClick={() => onEdit(h)}><Pencil size={14} /> עריכה</Button>
                <Button variant="danger" className="min-h-9" onClick={() => remove(h)} aria-label="מחיקה"><Trash2 size={14} /> מחיקה</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function DemoTab({ data, quotes, reload, onSell }) {
  const d = valueDemo(data.demo, quotes);
  const reset = async () => {
    if (!window.confirm('לאפס את תיק הדמה ולהתחיל מחדש עם 100,000 ₪?')) return;
    try {
      await api('/demo/reset');
      toast('תיק הדמה אופס');
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <>
      <p className="mb-3 text-sm text-muted">תיק דמה הוא תרגול: מתחילים עם {fmtILS(DEMO_START)} וירטואליים, קונים ומוכרים במחירים החיים של השוק, בלי סיכון אמיתי.</p>
      <Totals items={[
        ['שווי כולל', fmtILS(d.total)],
        ['מזומן', fmtILS(d.cash)],
        ['רווח מההתחלה', `${fmtSigned(d.gain)} (${fmtPct(d.gainPct)})`, tone(d.gain)],
      ]} />
      <SectionTitle>המניות שלי בדמה</SectionTitle>
      {d.rows.length === 0 && <Empty>עוד לא קניתם כלום. פתחו מניה ולחצו "תיק דמה".</Empty>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {d.rows.map((h) => {
          const cs = currencySymbol(h.currency);
          return (
            <Card key={h.id}>
              <div className="flex items-start justify-between gap-2">
                <Symbol h={h} />
                <Num className={`font-bold ${tone(h.gain)}`}>{fmtPct(h.gainPct)}</Num>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><Num>{+h.qty.toFixed(4)} × {cs}{fmtPrice(h.price)}</Num> ← <Num>{cs}{fmtPrice(h.now)}</Num></span>
                <Num className="font-bold">{fmtILS(h.valueILS)}</Num>
              </div>
              <Button variant="soft" className="mt-3 min-h-9 w-full" onClick={() => onSell(h)}>מכירה</Button>
            </Card>
          );
        })}
      </div>
      {data.demo?.trades?.length > 0 && (
        <>
          <SectionTitle>היסטוריית עסקאות</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {data.demo.trades.slice(0, 20).map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span><b className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.side === 'buy' ? 'קנייה' : 'מכירה'}</b> <Num>{+t.qty.toFixed(4)}</Num> <Num className="text-muted">{t.symbol}</Num></span>
                <span className="text-end"><Num>{fmtILS(t.ils)}</Num><span className="block text-xs text-muted">{timeAgo(t.t)}</span></span>
              </div>
            ))}
          </Card>
        </>
      )}
      <Button variant="danger" className="mt-4" onClick={reset}>איפוס תיק הדמה</Button>
    </>
  );
}

// רשימת קניות: מניות שהבוט הציע או שהוספתם, עם מחיר קנייה רצוי
function BuyTab({ data, quotes, reload }) {
  const items = data.watch.filter((w) => w.plan === 'buy');
  const act = async (body, msg) => {
    try {
      await api('/watch', body);
      if (msg) toast(msg);
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  if (!items.length) {
    return (
      <Empty>
        רשימת הקניות ריקה. אפשר לבקש מהבוט בצ'אט: "תמליץ לי על מניות ותוסיף לרשימת הקניות", או ללחוץ "לרשימת הקניות" בדף מניה.
      </Empty>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((w) => {
        const q = quotes?.[w.symbol];
        const cs = currencySymbol(q?.currency || w.currency);
        const hit = q && typeof w.target === 'number' && q.price <= w.target;
        return (
          <Card key={w.symbol}>
            <div className="flex items-start justify-between gap-2">
              <Symbol h={w} />
              <span className="shrink-0 text-end">
                <Num className="block font-medium">{q ? `${cs}${fmtPrice(q.price)}` : '–'}</Num>
                <Change value={q?.change} digits={1} className="text-xs" />
              </span>
            </div>
            {hit && <div className="mt-2 inline-block rounded-full bg-up-soft px-2.5 py-0.5 text-xs font-bold text-up">הגיע למחיר הקנייה 🎯</div>}
            {w.reason && <p className="mt-2 text-sm text-muted">{w.reason}</p>}
            {typeof w.target === 'number' && (
              <div className="mt-2 text-sm"><span className="text-xs text-muted">מחיר קנייה מוצע </span><Num className="font-bold">{cs}{fmtPrice(w.target)}</Num></div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={stockLink(w.symbol)} className="flex-1"><Button variant="soft" className="min-h-9 w-full">קניתי</Button></a>
              <Button variant="ghost" className="min-h-9 flex-1" onClick={() => act({ symbol: w.symbol, plan: null }, 'הוצאה מהרשימה, נשארה במעקב')}>להוציא מהרשימה</Button>
              <Button variant="danger" className="min-h-9" onClick={() => act({ symbol: w.symbol, remove: true }, 'הוסרה')} aria-label="הסרה"><Trash2 size={14} /></Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function WatchTab({ data, quotes, reload }) {
  const watchList = data.watch.filter((w) => w.plan !== 'buy');
  const removeWatch = async (symbol) => {
    try {
      await api('/watch', { symbol, remove: true });
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  const removeAlert = async (id) => {
    try {
      await api('/price-alert/delete', { id });
      reload();
    } catch (e) {
      toast(e.message);
    }
  };
  return (
    <>
      {watchList.length === 0 && <Empty>רשימת המעקב ריקה. בדף מניה לחצו על "מעקב".</Empty>}
      <Card className={`divide-y divide-line p-0 ${watchList.length ? '' : 'hidden'}`}>
        {watchList.map((w) => {
          const q = quotes?.[w.symbol];
          const sig = data.signals?.[w.symbol];
          return (
            <div key={w.symbol} className="flex items-center gap-2 px-4 py-3">
              <Symbol h={w} />
              <div className="ms-auto flex items-center gap-2">
                {sig && <><ScoreBadge score={sig.score} /><span className="hidden sm:inline"><VerdictBadge verdict={sig.verdict} /></span></>}
                <span className="text-end">
                  <Num className="block font-medium">{q ? `${currencySymbol(q.currency)}${fmtPrice(q.price)}` : '–'}</Num>
                  <Change value={q?.change} digits={1} className="text-xs" />
                </span>
                <button type="button" onClick={() => removeWatch(w.symbol)} aria-label="הסרה מהמעקב" className="rounded-lg p-1.5 text-muted hover:bg-soft"><X size={18} /></button>
              </div>
            </div>
          );
        })}
      </Card>
      <SectionTitle>התראות מחיר</SectionTitle>
      {data.palerts.length === 0 && <Empty>אין התראות מחיר. קבעו אותן בדף מניה.</Empty>}
      <Card className={`divide-y divide-line p-0 ${data.palerts.length ? '' : 'hidden'}`}>
        {data.palerts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
            <a href={stockLink(p.symbol)} className="flex items-center gap-2"><Bell size={16} className="text-accent" /> <b><bdi>{p.name || p.symbol}</bdi></b> {p.op === 'above' ? 'מעל' : 'מתחת ל-'}<Num className="font-bold">{fmtPrice(p.price)}</Num></a>
            <button type="button" onClick={() => removeAlert(p.id)} aria-label="מחיקת התראה" className="rounded-lg p-1.5 text-muted hover:bg-soft"><Trash2 size={16} /></button>
          </div>
        ))}
      </Card>
    </>
  );
}

export default function Portfolio({ params }) {
  const [tab, setTab] = useState(params?.get('tab') || 'real');
  // קישור ישיר ללשונית (למשל #/portfolio?tab=buy מהצ'אט)
  const tabParam = params?.get('tab');
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);
  const [data, setData] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [sell, setSell] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('/data');
      setData(d);
      const { quotes: q } = await api('/quotes', { symbols: neededSymbols([d.holdings, d.demo?.holdings, d.watch]) });
      setQuotes(q);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useLive(load, 30000);

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">התיק</h1>
      <Tabs tabs={[['real', 'התיק שלי'], ['demo', 'תיק דמה'], ['buy', '🛒 רשימת קניות'], ['watch', 'מעקב']]} value={tab} onChange={setTab} />
      {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
      {!data && !error && <Spinner />}
      {data && tab === 'real' && <RealTab data={data} quotes={quotes} reload={load} onEdit={setEdit} />}
      {data && tab === 'demo' && <DemoTab data={data} quotes={quotes} reload={load} onSell={setSell} />}
      {data && tab === 'buy' && <BuyTab data={data} quotes={quotes} reload={load} />}
      {data && tab === 'watch' && <WatchTab data={data} quotes={quotes} reload={load} />}
      {edit && <HoldingSheet symbol={edit.symbol} name={edit.name} price={edit.now} currency={edit.currency} holding={edit} onClose={() => setEdit(null)} onSaved={load} />}
      {sell && <DemoSheet symbol={sell.symbol} name={sell.name} price={sell.now} currency={sell.currency} demo={data?.demo} quotes={quotes} initialSide="sell" onClose={() => setSell(null)} onDone={load} />}
    </div>
  );
}
