// מחיקת כל הנתונים – מסך אזהרה: גיבוי לפני, הקלדת "מחק הכול" וסיסמה
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { resetAll } from '../lib/store';
import { Button, Sheet, inputCls } from './ui';

const WORDS = 'מחק הכול';

export default function ResetSheet({ onBackup, onClose, onDone }) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      await resetAll(password);
      onDone('כל הנתונים נמחקו');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet title="מחיקת כל הנתונים" onClose={onClose}>
      <div className="mb-4 flex gap-3 rounded-2xl border border-minus/40 bg-minus/10 p-4">
        <AlertTriangle className="shrink-0 text-minus" />
        <div className="space-y-1 text-sm">
          <p className="font-bold">זה ימחק הכול, ואי אפשר לבטל.</p>
          <p>כל ההכנסות, ההוצאות, התשלומים, היתרה, מעקב הכרטיסים ותשובות ה-AI יימחקו – בשרת ובכל המכשירים (טלפון ומחשב).</p>
          <p>הסיסמה נשארת. מומלץ לשמור גיבוי לפני.</p>
        </div>
      </div>
      <Button kind="ghost" className="mb-4 w-full" onClick={onBackup}>
        שמירת גיבוי לקובץ לפני המחיקה
      </Button>
      <label className="mb-3 block text-sm">
        כדי לאשר, כתבו <b>{WORDS}</b>:
        <input className={`${inputCls} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      <label className="mb-3 block text-sm">
        והסיסמה:
        <input type="password" className={`${inputCls} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      {error && <p className="mb-3 text-sm text-minus">{error}</p>}
      <div className="flex gap-2">
        <Button kind="ghost" className="flex-1" onClick={onClose}>
          ביטול
        </Button>
        <button
          disabled={typed.trim() !== WORDS || !password || busy}
          onClick={go}
          className="flex-1 rounded-xl bg-minus px-4 py-2.5 font-medium text-white disabled:opacity-40"
        >
          {busy ? 'מוחק…' : 'מחיקה סופית'}
        </button>
      </div>
    </Sheet>
  );
}
