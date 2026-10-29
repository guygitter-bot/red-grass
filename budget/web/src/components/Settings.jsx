// הגדרות: יתרה בבנק, מצב לילה, ייצוא לאקסל, גיבוי ושחזור, סיסמה ויציאה
import { useRef, useState } from 'react';
import { addMonths, monthName, thisMonth, toCsv } from '../lib/budget';
import { changePassword, logout, save } from '../lib/store';
import { getTheme, setTheme } from '../lib/theme';
import { Button, Field, Segmented, inputCls } from './ui';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Card({ title, children }) {
  return (
    <section className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function Settings({ data, records }) {
  const now = thisMonth();
  const [balance, setBalance] = useState(data.settings.balance == null ? '' : String(data.settings.balance));
  const [balanceMonth, setBalanceMonth] = useState(data.settings.balanceMonth || now);
  const [theme, setThemeState] = useState(getTheme());
  const [pw, setPw] = useState({ old: '', next: '' });
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const saveBalance = () => {
    const v = balance.trim() === '' ? '' : Number(balance.replace(/[,₪\s]/g, ''));
    if (v !== '' && !Number.isFinite(v)) return setMsg('היתרה צריכה להיות מספר');
    save({ id: 'settings', t: 'settings', balance: v, balanceMonth });
    setMsg('היתרה נשמרה');
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const list = (json.records || []).filter((r) => r && typeof r.id === 'string');
      if (!list.length) throw new Error();
      if (!confirm(`לשחזר ${list.length} רשומות מהגיבוי? רשומות שקיימות גם בגיבוי יחזרו למצב שבגיבוי.`)) return;
      save(list.map(({ updatedAt, rev, ...r }) => r));
      setMsg('השחזור הושלם');
    } catch {
      setMsg('הקובץ לא נראה כמו גיבוי של תקציב הבית');
    }
  };

  const submitPw = async (e) => {
    e.preventDefault();
    try {
      await changePassword(pw.old, pw.next);
      setPw({ old: '', next: '' });
      setMsg('הסיסמה הוחלפה. במכשירים האחרים צריך להיכנס מחדש.');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const months = Array.from({ length: 25 }, (_, i) => addMonths(now, i - 12));
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">הגדרות</h1>
      {msg && (
        <p className="mb-4 rounded-xl bg-soft p-3 text-sm" onClick={() => setMsg('')}>
          {msg}
        </p>
      )}

      <Card title="יתרה בבנק">
        <p className="mb-3 text-sm text-muted">כמה כסף היה בחשבון בתחילת חודש מסוים. ממנה מחושבת היתרה הצפויה בכל חודש קדימה.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="יתרה (אפשר במינוס)">
            <input className={`${inputCls} num`} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="₪" />
          </Field>
          <Field label="בתחילת חודש">
            <select className={inputCls} value={balanceMonth} onChange={(e) => setBalanceMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button onClick={saveBalance}>שמירה</Button>
      </Card>

      <Card title="תצוגה">
        <Segmented
          value={theme}
          onChange={(t) => {
            setTheme(t);
            setThemeState(t);
          }}
          options={[['auto', 'אוטומטי'], ['light', 'יום'], ['dark', 'לילה']]}
        />
      </Card>

      <Card title="אקסל וגיבוי">
        <div className="flex flex-wrap gap-2">
          <Button kind="ghost" onClick={() => download(`תקציב-הבית-${now}.csv`, toCsv(data, now, 24), 'text/csv;charset=utf-8')}>
            ייצוא לאקסל (24 חודשים)
          </Button>
          <Button kind="ghost" onClick={() => download(`גיבוי-תקציב-${now}.json`, JSON.stringify({ app: 'bayit-budget', at: new Date().toISOString(), records }, null, 1), 'application/json')}>
            גיבוי לקובץ
          </Button>
          <Button kind="ghost" onClick={() => fileRef.current?.click()}>
            שחזור מגיבוי
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={restore} />
        </div>
        <p className="mt-2 text-xs text-muted">הנתונים נשמרים גם בשרת ומסתנכרנים בין הטלפון למחשב. הגיבוי לקובץ הוא ליתר ביטחון.</p>
      </Card>

      <Card title="החלפת סיסמה">
        <form onSubmit={submitPw} className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <input type="password" className={inputCls} placeholder="הסיסמה הנוכחית" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" />
          <input type="password" className={inputCls} placeholder="סיסמה חדשה (6 תווים לפחות)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          <Button disabled={!pw.old || pw.next.length < 6}>החלפה</Button>
        </form>
      </Card>

      <Button
        kind="danger"
        className="w-full"
        onClick={() => {
          if (confirm('לצאת מהמכשיר הזה? הנתונים נשארים בשרת, וכדי לחזור צריך את הסיסמה.')) logout();
        }}
      >
        יציאה מהמכשיר הזה
      </Button>
    </div>
  );
}
