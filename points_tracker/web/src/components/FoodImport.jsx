import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Card, ErrorBox } from './ui';
import { addSharedFood } from '../lib/sharedFoods';
import { parseFoodList } from '../lib/foodImport';

// רק לבעל האפליקציה: ייבוא רשימת מאכלים מקובץ (שם + ניקוד) למאגר המשותף שבשרת.
// הרשימה לא נשמרת בקוד של האפליקציה (המאגר ב-GitHub ציבורי), אלא רק בשרת, שרק מכשירים מחוברים רואים.
export default function FoodImport({ settings, onDone }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    let foods;
    try {
      foods = parseFoodList(await file.text());
    } catch (err) {
      return setError(err.message);
    }
    if (!foods.length) return setError('לא מצאתי מאכלים בקובץ.');
    if (!confirm(`להוסיף ${foods.length} מאכלים למאגר המשותף? מאכל שכבר קיים באותו שם לא ישתנה.`)) return;
    setBusy(true);
    let added = 0;
    let done = 0;
    let failed = 0;
    // כמה בקשות במקביל, כדי שזה ייקח שניות ולא דקות
    const queue = [...foods];
    const worker = async () => {
      while (queue.length) {
        const food = queue.shift();
        try {
          const res = await addSharedFood(settings, { ...food, source: 'user' });
          if (res.added) added++;
        } catch {
          failed++;
        }
        done++;
        setStatus(`מוסיף... ${done} מתוך ${foods.length}`);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setBusy(false);
    setStatus(`נוספו ${added} מאכלים חדשים${foods.length - added - failed ? `, ${foods.length - added - failed} כבר היו במאגר` : ''}.`);
    if (failed) setError(`${failed} מאכלים לא נוספו (בעיית חיבור). אפשר לטעון את הקובץ שוב – מה שכבר נוסף לא יוכפל.`);
    onDone?.();
  };

  return (
    <Card className="space-y-3">
      <h3 className="font-bold text-slate-700 flex items-center gap-2">
        <FileUp size={18} /> ייבוא רשימת מאכלים מקובץ
      </h3>
      <p className="text-xs text-slate-500">
        קובץ JSON, או טקסט עם שורה לכל מאכל: שם, טאב (או פסיק אחרון) וניקוד. המאכלים נכנסים למאגר המשותף ונשמרים רק בשרת.
      </p>
      <label className={`block ${busy ? 'opacity-40 pointer-events-none' : ''}`}>
        <input type="file" accept=".json,.tsv,.txt,.csv,application/json,text/plain" onChange={onFile} className="hidden" />
        <span className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-slate-100 text-slate-600 cursor-pointer">
          <FileUp size={18} /> בחר קובץ
        </span>
      </label>
      {status && <p className="text-sm text-emerald-700">{status}</p>}
      <ErrorBox>{error}</ErrorBox>
    </Card>
  );
}
