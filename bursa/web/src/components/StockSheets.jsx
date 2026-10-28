// חלונות הפעולה בדף מניה: קניתי / תיק דמה / התראת מחיר
import { useState } from 'react';
import { api } from '../lib/api';
import { currencySymbol, fmtILS, fmtPrice } from '../lib/format';
import { toast } from '../lib/hooks';
import { rateOf } from '../lib/portfolio';
import { Button, ErrorBox, Field, Num, Sheet, inputCls } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

// הוספה/עריכה של מניה בתיק האמיתי. holding קיים = עריכה
export function HoldingSheet({ symbol, name, price, currency, holding, onClose, onSaved }) {
  const [qty, setQty] = useState(holding?.qty ?? '');
  const [buy, setBuy] = useState(holding?.price ?? (price ? String(price) : ''));
  const [date, setDate] = useState(holding?.date || today());
  const [stop, setStop] = useState(holding?.stop ?? '');
  const [target, setTarget] = useState(holding?.target ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/holding', { holding: { id: holding?.id, symbol, name, currency: holding?.currency || currency, qty, price: buy, date, stop, target } });
      toast(holding ? 'השינויים נשמרו' : 'נוסף לתיק שלך');
      onSaved?.(r.holdings);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={<>{holding ? 'עריכה' : 'קניתי'}: <bdi>{name || symbol}</bdi></>} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="כמות מניות"><input inputMode="decimal" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} dir="ltr" autoFocus /></Field>
        <Field label={`מחיר קנייה (${currencySymbol(holding?.currency || currency)})`}><input inputMode="decimal" type="number" min="0" step="any" value={buy} onChange={(e) => setBuy(e.target.value)} className={inputCls} dir="ltr" /></Field>
      </div>
      <Field label="תאריך קנייה"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} dir="ltr" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סטופ לוס (לא חובה)" hint="תקבלו התראה אם המחיר יורד לכאן"><input inputMode="decimal" type="number" min="0" step="any" value={stop} onChange={(e) => setStop(e.target.value)} className={inputCls} dir="ltr" /></Field>
        <Field label="יעד מכירה (לא חובה)" hint="התראה כשהמחיר מגיע לכאן"><input inputMode="decimal" type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} dir="ltr" /></Field>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button busy={busy} onClick={save} className="mt-3 w-full">שמירה</Button>
    </Sheet>
  );
}

// קנייה/מכירה בתיק הדמה (כסף וירטואלי, במחיר החי)
export function DemoSheet({ symbol, name, price, currency, demo, quotes, initialSide = 'buy', onClose, onDone }) {
  const [side, setSide] = useState(initialSide);
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owned = demo?.holdings?.find((h) => h.symbol === symbol)?.qty || 0;
  const rate = rateOf(currency, quotes);
  const total = price && rate && Number(qty) > 0 ? price * Number(qty) * rate : null;

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/demo/trade', { symbol, side, qty: Number(qty) });
      toast(side === 'buy' ? 'נקנה בתיק הדמה' : 'נמכר בתיק הדמה');
      onDone?.(r);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={<>תיק דמה: <bdi>{name || symbol}</bdi></>} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">תרגול בכסף וירטואלי, במחיר החי. במזומן: <Num className="font-bold text-ink">{fmtILS(demo?.cash)}</Num>. במניה הזאת יש לכם: <Num className="font-bold text-ink">{owned}</Num>.</p>
      <div className="mb-3 flex gap-1 rounded-xl bg-soft p-1">
        {[['buy', 'קנייה'], ['sell', 'מכירה']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSide(id)} className={`min-h-9 flex-1 rounded-lg text-sm font-medium ${side === id ? 'bg-card text-accent-ink shadow-sm' : 'text-muted'}`}>{label}</button>
        ))}
      </div>
      <Field label="כמה מניות?"><input inputMode="decimal" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} dir="ltr" autoFocus /></Field>
      <p className="mb-3 text-sm text-muted">מחיר עכשיו: <Num>{currencySymbol(currency)}{fmtPrice(price)}</Num>{total != null && <> · סה"כ בערך <Num className="font-bold text-ink">{fmtILS(total)}</Num></>}</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button busy={busy} disabled={!(Number(qty) > 0)} onClick={go} className="mt-1 w-full">{side === 'buy' ? 'קנייה' : 'מכירה'}</Button>
    </Sheet>
  );
}

export function AlertSheet({ symbol, name, price, currency, onClose, onDone }) {
  const [op, setOp] = useState('above');
  const [value, setValue] = useState(price ? String(price) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/price-alert', { symbol, op, price: Number(value) });
      toast('ההתראה נקבעה');
      onDone?.(r.palerts);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={<>התראת מחיר: <bdi>{name || symbol}</bdi></>} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">נשלח לכם התראה לטלפון כשהמחיר יגיע לשם. עכשיו: <Num>{currencySymbol(currency)}{fmtPrice(price)}</Num></p>
      <div className="mb-3 flex gap-1 rounded-xl bg-soft p-1">
        {[['above', 'כשהמחיר עולה מעל'], ['below', 'כשהמחיר יורד מתחת']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setOp(id)} className={`min-h-9 flex-1 rounded-lg px-1 text-sm font-medium ${op === id ? 'bg-card text-accent-ink shadow-sm' : 'text-muted'}`}>{label}</button>
        ))}
      </div>
      <Field label={`מחיר (${currencySymbol(currency)})`}><input inputMode="decimal" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} dir="ltr" autoFocus /></Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button busy={busy} disabled={!(Number(value) > 0)} onClick={go} className="mt-1 w-full">קביעת התראה</Button>
    </Sheet>
  );
}
