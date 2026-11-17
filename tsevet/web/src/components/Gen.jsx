// כרטיס של סרטון חדש מהמחולל: קודם הצעה שמחכה לאישור (עולה כסף), ואז הסרטון עצמו
import { useState } from 'react';
import { Clapperboard, Download } from 'lucide-react';
import { api } from '../lib/api';
import { FileView } from './Files';
import { Button, Spinner } from './ui';

// הצ'אט מאזין לאירוע הזה ומרענן את השיחה (ההודעות עצמן לא מצוירות מחדש בלי שינוי)
export const RELOAD = 'tsevet:reload';

export function GenCard({ gen }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { id: gen.id });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };

  const details = `${gen.seconds} שניות · ${gen.aspect} · ${gen.quality === 'draft' ? 'טיוטה' : 'איכות מלאה'}${gen.hasImage ? ' · מתחיל מהתמונה' : ''}`;

  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm">
      <div className="flex items-start gap-2">
        <Clapperboard size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{gen.summary}</div>
          <div className="text-xs text-muted">{details}</div>
        </div>
      </div>

      {gen.status === 'proposed' && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">יצירת סרטון עולה כסף בחשבון Google (פחות מדולר לסרטון). שום דבר לא נוצר בלי אישור.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/gen/approve')}>
              {busy ? 'רגע…' : 'ליצור סרטון'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/gen/cancel')}>
              לא עכשיו
            </Button>
            <button className="px-2 text-xs text-muted underline" onClick={() => setOpen(!open)}>
              {open ? 'להסתיר את ההנחיה' : 'מה נשלח למחולל?'}
            </button>
          </div>
          {open && (
            <p dir="ltr" className="mt-2 rounded-lg bg-soft p-2 text-start text-xs break-words">
              {gen.prompt}
            </p>
          )}
        </div>
      )}
      {gen.status === 'working' && (
        <div className="mt-3 flex items-center gap-2 text-muted">
          <Spinner /> יוצר את הסרטון… זה לוקח דקה-שתיים
        </div>
      )}
      {gen.status === 'done' && gen.file && (
        <div className="mt-3 space-y-2">
          <FileView file={gen.file} />
          <a href={`${gen.file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-medium hover:bg-soft">
            <Download size={15} /> הורדה
          </a>
        </div>
      )}
      {gen.status === 'cancelled' && <div className="mt-2 text-muted">בוטל</div>}
      {gen.status === 'failed' && <div className="mt-2 text-bad">{gen.error || 'הסרטון לא נוצר'}</div>}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
