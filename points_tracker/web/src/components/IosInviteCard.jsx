import { useState } from 'react';
import { Copy, Share, SquarePlus } from 'lucide-react';
import { Button, Card } from './ui';

// מוצג כשקישור הזמנה נפתח ב-Safari באייפון: הקישור עוד לא נוצל.
export default function IosInviteCard({ link, onUseHere, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('העתק/י את הקישור:', link);
    }
  };
  return (
    <Card className="mb-4 border-violet-200 space-y-3">
      <h3 className="font-bold text-violet-700">קיבלת הזמנה לביס 🎉</h3>
      <p className="text-sm text-slate-600">באייפון כדאי להתקין קודם את האפליקציה, ורק אז להשתמש בקישור (הוא עובד פעם אחת):</p>
      <ol className="text-sm text-slate-700 space-y-2 list-decimal pr-5">
        <li>
          <Button variant="ai" className="py-2 px-3 inline-flex" onClick={copy}>
            <Copy size={16} /> {copied ? 'הקישור הועתק ✓' : 'העתק את קישור ההזמנה'}
          </Button>
        </li>
        <li>
          ב-Safari לוחצים על <Share size={14} className="inline" /> שיתוף ← <SquarePlus size={14} className="inline" /> "הוסף למסך
          הבית".
        </li>
        <li>פותחים את ביס ממסך הבית ← הגדרות ← "יש לך קישור הזמנה?" ← מדביקים.</li>
      </ol>
      <div className="flex gap-3 text-xs">
        <button className="text-slate-400 underline" onClick={onUseHere}>
          להשתמש כאן בדפדפן בלי להתקין
        </button>
        <button className="text-slate-400 underline" onClick={onClose}>
          סגור
        </button>
      </div>
    </Card>
  );
}
