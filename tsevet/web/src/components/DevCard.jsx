// כרטיס של שינוי בקוד מ-👨‍💻 המתכנת: הצעה -> אישור -> עבודה ב-GitHub -> PR מוכן -> מיזוג (ואז האפליקציה עולה)
import { useState } from 'react';
import { Code2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

const STATUS = {
  proposed: 'מחכה לאישור שלך',
  working: 'המתכנת עובד על זה ב-GitHub…',
  ready: 'מוכן לבדיקה ולמיזוג',
  question: 'יש שאלה – אפשר לענות בשיחה',
  merged: 'מוזג ✓ – האפליקציה עולה לאוויר בדקות הקרובות',
  cancelled: 'בוטל',
  discarded: 'בוטל',
  failed: 'לא הצליח',
};

export function DevCard({ dev }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { id: dev.id });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };

  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm">
      <div className="flex items-start gap-2">
        <Code2 size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{dev.title}</div>
          <div className="text-xs text-muted">
            <span dir="ltr">{dev.app}/</span> · {STATUS[dev.status] || dev.status}
          </div>
        </div>
      </div>
      {dev.summary && dev.status === 'proposed' && <p className="mt-2 break-words">{dev.summary}</p>}

      {dev.status === 'proposed' && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">אחרי האישור Claude עושה את השינוי ב-GitHub ומריץ בדיקות (עלות של בערך דולר-כמה דולרים). שום דבר לא עולה לאוויר לפני שתמזג.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/dev/approve')}>
              {busy ? 'רגע…' : 'לאשר ולהתחיל'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/dev/cancel')}>
              לא עכשיו
            </Button>
          </div>
        </div>
      )}
      {dev.status === 'working' && (
        <div className="mt-3 flex items-center gap-2 text-muted">
          <Spinner /> עובד על השינוי ומריץ בדיקות… בדרך כלל 5-20 דקות
        </div>
      )}
      {dev.status === 'ready' && (
        <div className="mt-3 space-y-2">
          {dev.result && <p className="whitespace-pre-line break-words">{dev.result}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => act('/app/dev/merge')}>
              {busy ? 'רגע…' : 'למזג ולהעלות'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/dev/discard')}>
              לבטל את השינוי
            </Button>
            {dev.url && (
              <a href={dev.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1 text-xs text-muted underline">
                <ExternalLink size={12} /> לראות ב-GitHub
              </a>
            )}
          </div>
          <p className="text-xs text-muted">
            המיזוג אפשרי רק כשהבדיקות ב-GitHub עברו.{dev.cost ? ` העבודה עלתה $${dev.cost.toFixed(2)}.` : ''}
          </p>
        </div>
      )}
      {dev.status === 'question' && dev.question && <p className="mt-2 whitespace-pre-line break-words">{dev.question}</p>}
      {dev.status === 'failed' && <div className="mt-2 text-bad">{dev.error}</div>}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
