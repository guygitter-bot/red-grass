// כרטיס של תמונה חדשה ממחולל התמונות: קודם הצעה שמחכה לאישור (עולה כסף), ואז התמונה עצמה
import { useState } from 'react';
import { Download, ImagePlus } from 'lucide-react';
import { api } from '../lib/api';
import { FileView } from './Files';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

export function ImageCard({ image }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      const r = await api(path, { id: image.id });
      if (r?.ok === false && r.error) setError(r.error);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };

  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm">
      <div className="flex items-start gap-2">
        <ImagePlus size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{image.summary}</div>
          <div className="text-xs text-muted">
            תמונה · {image.aspect}
            {image.hasImage ? ' · מתחילה מהתמונה ששלחת' : ''}
          </div>
        </div>
      </div>

      {image.status === 'proposed' && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">תמונה עולה בערך 4 סנט בחשבון Google. שום דבר לא נוצר בלי אישור.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/image/approve')}>
              {busy ? 'יוצר…' : 'ליצור תמונה'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/image/cancel')}>
              לא עכשיו
            </Button>
            <button className="px-2 text-xs text-muted underline" onClick={() => setOpen(!open)}>
              {open ? 'להסתיר את ההנחיה' : 'מה נשלח למחולל?'}
            </button>
          </div>
          {open && (
            <p dir="ltr" className="mt-2 rounded-lg bg-soft p-2 text-start text-xs break-words">
              {image.prompt}
            </p>
          )}
        </div>
      )}
      {image.status === 'working' && (
        <div className="mt-3 flex items-center gap-2 text-muted">
          <Spinner /> יוצר את התמונה… בדרך כלל פחות מחצי דקה
        </div>
      )}
      {image.status === 'done' && image.file && (
        <div className="mt-3 space-y-2">
          <FileView file={image.file} />
          <a href={`${image.file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-medium hover:bg-soft">
            <Download size={15} /> הורדה
          </a>
        </div>
      )}
      {image.status === 'cancelled' && <div className="mt-2 text-muted">בוטל</div>}
      {image.status === 'failed' && <div className="mt-2 text-bad">{image.error || 'התמונה לא נוצרה'}</div>}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
