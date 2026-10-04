import { useState } from 'react';
import { ImagePlus, Wrench, X } from 'lucide-react';
import { Button, Card, ErrorBox } from './ui';
import { fileToDataUrl } from '../lib/image';
import { sendFeedback } from '../lib/proxy';

const ERRORS = {
  429: 'נשלחו היום הרבה בקשות. אפשר לשלוח שוב מחר.',
  500: 'שליחת תיקונים עוד לא הופעלה בשרת. ספר/י לבעל האפליקציה.',
};

// שליחת תיקון או הצעה. הבקשה נפתחת ב-GitHub (issue עם התווית bis-fix).
export default function FeedbackCard({ settings }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await fileToDataUrl(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const context = {
        env: import.meta.env.VITE_APP_ENV === 'staging' ? 'staging' : 'production',
        view: 'settings',
        device: navigator.userAgent,
      };
      const { number } = await sendFeedback(settings, { text, image, context });
      setSent(number);
      setText('');
      setImage(null);
    } catch (err) {
      setError(ERRORS[err.status] || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 border-amber-100">
      <h3 className="font-bold text-amber-700 flex items-center gap-2">
        <Wrench size={18} /> שלח תיקון או הצעה
      </h3>
      {sent ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">
            נשלח ✓ (בקשה מספר {sent}). הבקשה הגיעה לבעל האפליקציה.
          </p>
          <button className="text-xs text-slate-400 underline" onClick={() => setSent(null)}>
            לשלוח תיקון נוסף
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            כתוב/י מה לא עובד או מה כדאי לשנות. כמה שיותר ברור, למשל: "במסך הוספת אוכל, הכפתור של המועדפים קטן מדי".
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={3000}
            rows={4}
            placeholder="מה לתקן?"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {image ? (
            <div className="relative inline-block">
              <img src={image} alt="צילום מסך" className="h-24 rounded-lg border border-slate-200" />
              <button
                onClick={() => setImage(null)}
                className="absolute -top-2 -left-2 bg-white rounded-full p-1 shadow text-slate-500"
                aria-label="הסר צילום מסך"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="file" accept="image/*" onChange={pickImage} className="hidden" />
              <ImagePlus size={18} /> צרף צילום מסך (לא חובה)
            </label>
          )}
          <ErrorBox>{error}</ErrorBox>
          <Button onClick={send} disabled={!text.trim() || busy} className="w-full bg-amber-500 shadow-amber-200 hover:bg-amber-600">
            {busy ? 'שולח...' : 'שלח תיקון'}
          </Button>
          <p className="text-[11px] text-slate-400">הטקסט נשמר בבקשה ב-GitHub. צילום המסך נשמר רק בשרת של האפליקציה.</p>
        </>
      )}
    </Card>
  );
}
