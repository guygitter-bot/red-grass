// ייבוא מדידות החיישן מקובץ CareLink (דוחות ← ייצוא נתונים CSV). הקריאה במכשיר; נשמרת רשומת cgm אחת לכל יום,
// ומדידות מהאצבע (אם יש) כמדידות רגילות. ייבוא חוזר של אותם ימים מתמזג ולא מכפיל.
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cgmRecords, readCarelink } from '../lib/carelink';
import { save } from '../lib/store';
import { Button } from './ui';

const short = (d) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}`;

export default function SensorImport({ data, onDone }) {
  const ref = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setParsed(null);
    try {
      const r = readCarelink(await file.text());
      if (!r.count && !r.bg.length) throw new Error('לא נמצאו בקובץ מדידות חיישן');
      setParsed(r);
    } catch (err) {
      setError(err.message);
    }
  };

  const doImport = () => {
    const recs = cgmRecords(parsed, data.cgm);
    // מדידה מהאצבע – מזהה קבוע לפי הזמן, כדי שייבוא חוזר לא יכפיל
    const bg = parsed.bg.map((b) => ({ id: `bg:${b.date}:${b.time}`, t: 'reading', date: b.date, time: b.time, value: b.value, note: 'מד סוכר (CareLink)' }));
    save([...recs, ...bg]);
    const n = parsed.count;
    setParsed(null);
    onDone(`יובאו ${n.toLocaleString('he-IL')} מדידות חיישן ל-${recs.length} ימים`);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        באתר CareLink (מהמחשב): דוחות ← בתחתית העמוד &quot;ייצוא נתונים (CSV)&quot; ← מורידים את הקובץ ומעלים אותו כאן. מדידות החיישן (כל 5 דקות) נכנסות
        לגרף, למעקב ולניתוח, ומשלימות את הסוכר לפני ואחרי כל ארוחה. ייבוא חוזר לא מכפיל.
      </p>
      <Button kind="ghost" className="flex items-center gap-2" onClick={() => ref.current?.click()}>
        <Upload size={18} /> בחירת קובץ מ-CareLink
      </Button>
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={pick} />
      {error && <p className="mt-3 rounded-xl bg-low/15 p-3 text-sm text-low">{error}</p>}
      {parsed && (
        <div className="mt-3 rounded-xl border border-accent p-3 text-sm">
          <p className="mb-2">
            נמצאו <b className="num">{parsed.count.toLocaleString('he-IL')}</b> מדידות חיישן, מ-{short(parsed.from)} עד {short(parsed.to)} ({parsed.days.size} ימים)
            {parsed.bg.length > 0 && ` ועוד ${parsed.bg.length} מדידות מהאצבע`}.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={doImport}>
              לייבא
            </Button>
            <Button kind="ghost" onClick={() => setParsed(null)}>
              ביטול
            </Button>
          </div>
        </div>
      )}
      {data.cgm.size > 0 && !parsed && (
        <p className="mt-2 text-xs text-muted">
          ביומן כבר יש נתוני חיישן ל-{data.cgm.size} ימים (עד {short([...data.cgm.keys()].sort().at(-1))}).
        </p>
      )}
    </div>
  );
}
