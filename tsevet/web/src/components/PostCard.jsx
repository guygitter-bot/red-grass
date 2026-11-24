// כרטיס פוסט / ריל לאינסטגרם ולפייסבוק (📱 סושיאל): תצוגה מקדימה, ופרסום רק אחרי "לאשר" – מיד או בשעה שנקבעה
import { useState } from 'react';
import { CalendarClock, ExternalLink, Send } from 'lucide-react';
import { api } from '../lib/api';
import { uploadBlob } from '../lib/media';
import { FileView } from './Files';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

const NAMES = { instagram: 'אינסטגרם', facebook: 'פייסבוק' };
const STATUS = { scheduled: 'מתוזמן', publishing: 'מתפרסם…', done: 'פורסם', failed: 'הפרסום נכשל', cancelled: 'בוטל' };
const when = (t) => new Date(t).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

// אינסטגרם מקבל רק JPEG: ממירים כאן בטלפון ומעלים כקובץ חדש
async function toJpeg(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('לא הצלחנו להכין את התמונה');
  const bmp = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
  return uploadBlob(blob, { name: 'post.jpg', type: 'image/jpeg', w: canvas.width, h: canvas.height });
}

export function PostCard({ post }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      try {
        await api(path, { id: post.id });
      } catch (e) {
        if (e.message !== 'needs-jpeg' || !post.file) throw e;
        const jpg = await toJpeg(post.file.url);
        await api(path, { id: post.id, jpeg: jpg.id });
      }
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };

  const open = ['proposed', 'failed'].includes(post.status);
  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm text-ink">
      <div className="flex items-start gap-2">
        {post.when ? <CalendarClock size={18} className="mt-0.5 shrink-0 text-accent-ink" /> : <Send size={18} className="mt-0.5 shrink-0 text-accent-ink" />}
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {post.kind === 'reel' ? 'ריל' : 'פוסט'} ל{post.targets.map((t) => NAMES[t]).join(' ול')}
            {post.page && <span className="font-normal text-muted"> · {post.page.ig ? `@${post.page.ig}` : post.page.name}</span>}
          </div>
          <div className="text-xs text-muted">{post.when ? `מתוזמן ל${when(post.when)}` : 'מיד אחרי האישור'}</div>
          {STATUS[post.status] && (
            <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${post.status === 'done' ? 'font-medium text-ok' : post.status === 'failed' ? 'text-bad' : 'text-muted'}`}>
              {post.status === 'publishing' && <Spinner size={11} />}
              {STATUS[post.status]}
            </div>
          )}
        </div>
      </div>

      {post.file && (
        <div className="mt-2">
          <FileView file={post.file} />
        </div>
      )}
      {post.text && <p className="mt-2 rounded-lg bg-card p-2.5 whitespace-pre-line break-words" dir="auto">{post.text}</p>}

      {Object.keys(post.results || {}).length > 0 && (
        <ul className="mt-2 space-y-1">
          {Object.entries(post.results).map(([t, r]) => (
            <li key={t} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{NAMES[t]}:</span>
              {r.done && r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 !text-accent-ink underline">
                  <ExternalLink size={12} /> לפוסט
                </a>
              ) : r.error ? (
                <span className="text-bad">{r.error}</span>
              ) : (
                <span className="text-muted">בתהליך…</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">{post.when ? 'אחרי האישור זה יעלה לבד בשעה שנקבעה (אפשר לבטל עד אז).' : 'אחרי האישור זה עולה מיד.'} שום דבר לא מתפרסם בלי אישור.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/social/approve')}>
              {busy ? 'רגע…' : post.status === 'failed' ? 'לנסות שוב' : post.when ? 'לאשר ולתזמן' : 'לאשר ולפרסם'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/social/cancel')}>
              לא עכשיו
            </Button>
          </div>
        </div>
      )}
      {post.status === 'scheduled' && (
        <button disabled={busy} onClick={() => confirm('לבטל את התזמון? הפוסט לא יעלה.') && act('/app/social/cancel')} className="mt-2 px-1 text-xs text-muted underline">
          לבטל את התזמון
        </button>
      )}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
