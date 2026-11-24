// כרטיס פרסום אתר: הצעה של הבוט לפרסם דף בכתובת ציבורית. עולה לאוויר רק אחרי "לפרסם", ואפשר להוריד
import { useState } from 'react';
import { Copy, ExternalLink, Globe } from 'lucide-react';
import { api } from '../lib/api';
import { copyText } from '../lib/copy';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

const LABEL = { live: 'באוויר', removed: 'הורד מהאוויר', replaced: 'הוחלף בגרסה חדשה', cancelled: 'בוטל', publishing: 'מעלה לאוויר… דקה-שתיים', removing: 'מוריד מהאוויר…' };

export function SiteCard({ site }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { id: site.id });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };
  const copy = async () => {
    if (await copyText(site.url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const live = site.status === 'live';
  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm text-ink">
      <div className="flex items-start gap-2">
        <Globe size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{site.title || 'אתר'}</div>
          <div dir="ltr" className="truncate text-start text-xs text-muted">
            {site.url}
          </div>
          {LABEL[site.status] && (
            <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${live ? 'font-medium text-ok' : 'text-muted'}`}>
              {['publishing', 'removing'].includes(site.status) && <Spinner size={11} />}
              {LABEL[site.status]}
            </div>
          )}
        </div>
      </div>

      {['proposed', 'failed'].includes(site.status) && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">אתר משלו בכתובת pages.dev, פתוח לכל מי שיש לו את הקישור. בלי עלות. שום דבר לא עולה בלי אישור.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/site/approve')}>
              {busy ? 'מפרסם…' : site.status === 'failed' ? 'לנסות שוב' : 'לפרסם'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/site/cancel')}>
              לא עכשיו
            </Button>
          </div>
        </div>
      )}
      {live && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-medium !text-ink hover:bg-soft">
            <ExternalLink size={15} /> לפתוח
          </a>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-medium hover:bg-soft">
            <Copy size={15} /> {copied ? 'הועתק' : 'להעתיק קישור'}
          </button>
          <button disabled={busy} onClick={() => confirm('להוריד את האתר מהאוויר? הקישור יפסיק לעבוד.') && act('/app/site/remove')} className="px-2 text-xs text-muted underline">
            להוריד מהאוויר
          </button>
        </div>
      )}
      {(error || site.error) && <div className="mt-2 text-bad">{error || site.error}</div>}
    </div>
  );
}
