// הגדרות: השם שלי (במכשיר), פרטים וטווח יעד, הגדרות מהצוות (לא חובה), שיתוף, מצב לילה, ייצוא וגיבוי
import { useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { numOrEmpty, toCsv } from '../lib/diary';
import { save } from '../lib/store';
import { getMe, setMe } from '../lib/me';
import { getTheme, setTheme } from '../lib/theme';
import { Button, Field, Segmented, inputCls } from './ui';
import SensorImport from './SensorImport';

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

const str = (v) => (v === '' || v == null ? '' : String(v));

export default function Settings({ data, records }) {
  const s = data.settings;
  const [me, setMeState] = useState(getMe());
  const [f, setF] = useState({ person: s.person, low: str(s.low), high: str(s.high), icr: str(s.icr), cf: str(s.cf), target: str(s.target), note: s.note });
  const [theme, setThemeState] = useState(getTheme());
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const day = data.today;

  const saveSettings = (e) => {
    e.preventDefault();
    const low = numOrEmpty(f.low);
    const high = numOrEmpty(f.high);
    if (!(low > 0) || !(high > low)) return setMsg('טווח היעד לא תקין');
    save({ id: 'settings', t: 'settings', person: f.person.trim(), low, high, icr: numOrEmpty(f.icr), cf: numOrEmpty(f.cf), target: numOrEmpty(f.target), note: f.note.trim().slice(0, 1000) });
    setMsg('נשמר – אצל כל מי שמשתף');
  };

  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    const text = `יומן הסוכר${s.person ? ` של ${s.person}` : ''}: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: 'יומן סוכר', text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg('הקישור הועתק');
      }
    } catch {
      // ביטול השיתוף
    }
  };

  const backup = () => download(`גיבוי-יומן-סוכר-${day}.json`, JSON.stringify({ app: 'yoman-sukar', at: new Date().toISOString(), records }, null, 1), 'application/json');

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.app !== 'yoman-sukar') throw new Error();
      const list = (json.records || []).filter((r) => r && typeof r.id === 'string');
      if (!list.length) throw new Error();
      if (!confirm(`לשחזר ${list.length} רשומות מהגיבוי? רשומות שקיימות גם בגיבוי יחזרו למצב שבגיבוי.`)) return;
      save(list.map(({ updatedAt, rev, ...r }) => r));
      setMsg('השחזור הושלם');
    } catch {
      setMsg('הקובץ לא נראה כמו גיבוי של יומן סוכר');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">הגדרות</h1>
      {msg && (
        <p className="mb-4 rounded-xl bg-soft p-3 text-sm" onClick={() => setMsg('')}>
          {msg}
        </p>
      )}

      <Card title="מי אני (במכשיר הזה)">
        <div className="flex gap-2">
          <input className={inputCls} value={me} onChange={(e) => setMeState(e.target.value)} placeholder="למשל: אמא" />
          <Button
            onClick={() => {
              setMe(me);
              setMsg('השם נשמר במכשיר הזה');
            }}
          >
            שמירה
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">השם נרשם ליד כל ארוחה ושאלה, כדי לדעת מי רשם.</p>
      </Card>

      <Card title="שיתוף">
        <p className="mb-3 text-sm text-muted">כל מי שיש לו את הקישור רואה ועורך את אותו יומן – בזמן אמת, בטלפון או במחשב.</p>
        <Button kind="ghost" onClick={share} className="flex items-center gap-2">
          <Share2 size={18} /> לשלוח קישור
        </Button>
      </Card>

      <form onSubmit={saveSettings}>
        <Card title="פרטים וטווח יעד">
          <Field label="שם (של מי היומן)">
            <input className={inputCls} value={f.person} onChange={(e) => set({ person: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="טווח תקין לפני ארוחה – מ־ (mg/dL)">
              <input className={`${inputCls} num`} inputMode="numeric" value={f.low} onChange={(e) => set({ low: e.target.value })} />
            </Field>
            <Field label="עד">
              <input className={`${inputCls} num`} inputMode="numeric" value={f.high} onChange={(e) => set({ high: e.target.value })} />
            </Field>
          </div>
          <p className="mb-3 text-xs text-muted">ברירת המחדל 70-110. מתחת לטווח – אדום, מעליו – כתום. המחשבון מוסיף תיקון רק מעל הטווח.</p>
        </Card>
        <Card title="נתונים למחשבון">
          <p className="mb-3 text-sm text-muted">יחס פחמימות: כמה גרם פחמימה מכסה יחידת אינסולין אחת (ברירת מחדל 15). פקטור תיקון ויעד – רק אם הצוות נתן; בלי פקטור תיקון המחשבון לא מוסיף תיקון כשהסוכר גבוה.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="יחס פחמימות" hint="גרם ליחידה">
              <input className={`${inputCls} num`} inputMode="decimal" value={f.icr} onChange={(e) => set({ icr: e.target.value })} />
            </Field>
            <Field label="פקטור תיקון" hint="כמה יחידה מורידה">
              <input className={`${inputCls} num`} inputMode="decimal" value={f.cf} onChange={(e) => set({ cf: e.target.value })} />
            </Field>
            <Field label="יעד לתיקון" hint="mg/dL">
              <input className={`${inputCls} num`} inputMode="numeric" value={f.target} onChange={(e) => set({ target: e.target.value })} />
            </Field>
          </div>
          <Field label="דברים שחשוב שה-AI יידע" hint="למשל: סוג האינסולין, משאבה/זריקות, חיישן, גיל">
            <textarea className={inputCls} rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
          <Button>שמירה</Button>
        </Card>
      </form>

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

      <Card title="📡 נתוני החיישן (Simplera / CareLink)">
        <SensorImport
          data={data}
          onDone={(m) => {
            setMsg(m);
            window.scrollTo(0, 0);
          }}
        />
      </Card>

      <Card title="ייצוא וגיבוי">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download(`יומן-סוכר-${day}.csv`, toCsv(data), 'text/csv;charset=utf-8')}>ייצוא לאקסל (לרופא/ה)</Button>
          <Button kind="ghost" onClick={backup}>
            גיבוי לקובץ
          </Button>
          <Button kind="ghost" onClick={() => fileRef.current?.click()}>
            שחזור מגיבוי
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={restore} />
        </div>
        <p className="mt-2 text-xs text-muted">הנתונים שמורים בשרת ומסתנכרנים בין כל המכשירים. הגיבוי לקובץ – ליתר ביטחון.</p>
      </Card>
    </div>
  );
}
