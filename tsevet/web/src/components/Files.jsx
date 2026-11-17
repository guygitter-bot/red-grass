// קבצים בהודעה (תמונה / סרטון / הקלטה) וכרטיס עריכת סרטון ברקע
import { useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { Spinner } from './ui';

export function FileView({ file }) {
  if (file.kind === 'image')
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={file.url} alt={file.name} loading="lazy" className="max-h-64 max-w-full rounded-xl border border-line object-cover" />
      </a>
    );
  if (file.kind === 'video')
    return <video src={file.url} poster={file.poster || undefined} controls preload="metadata" playsInline className="max-h-80 w-full rounded-xl bg-black" />;
  if (file.kind === 'audio') return <audio src={file.url} controls preload="metadata" className="w-full" />;
  if (file.kind === 'doc') return <DocView file={file} />;
  return null;
}

// קובץ שהצוות יצר: דף נחיתה / איור / מסמך / טבלה. דף ואיור – גם תצוגה מקדימה (בלי גישה לאפליקציה: sandbox)
const DOC_LABEL = { html: 'דף', svg: 'איור', md: 'מסמך', csv: 'טבלה', json: 'נתונים', txt: 'טקסט' };
function DocView({ file }) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const [show, setShow] = useState(ext === 'html' || ext === 'svg');
  const kb = file.size ? `${Math.max(1, Math.round(file.size / 1024))}KB` : '';
  return (
    <div className="rounded-xl border border-line bg-card p-2.5 text-sm">
      <div className="flex items-center gap-2">
        <FileText size={18} className="shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium" dir="auto">{file.name}</div>
          <div className="text-xs text-muted">
            {DOC_LABEL[ext] || 'קובץ'}
            {kb ? ` · ${kb}` : ''}
          </div>
        </div>
      </div>
      {show && (ext === 'html' || ext === 'svg') && (
        <iframe title={file.name} src={file.url} sandbox="allow-scripts allow-popups" loading="lazy" className="mt-2 h-96 w-full rounded-lg border border-line bg-white" />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-page px-3 py-1.5 font-medium hover:bg-soft">
          <ExternalLink size={15} /> לפתוח
        </a>
        <a href={`${file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-page px-3 py-1.5 font-medium hover:bg-soft">
          <Download size={15} /> הורדה
        </a>
        {(ext === 'html' || ext === 'svg') && (
          <button onClick={() => setShow(!show)} className="px-1 text-xs text-muted underline">
            {show ? 'להסתיר תצוגה' : 'תצוגה מקדימה'}
          </button>
        )}
      </div>
    </div>
  );
}

export function RenderCard({ render }) {
  return (
    <div className="rounded-xl border border-line bg-page p-3">
      {render.status === 'queued' && (
        <div className="flex items-center gap-2 text-sm">
          <Spinner />
          <div>
            <div className="font-medium">{render.label}</div>
            <div className="text-xs text-muted">עורך… זה לוקח כמה דקות</div>
          </div>
        </div>
      )}
      {render.status === 'done' && render.file && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{render.label}</div>
          <FileView file={render.file} />
          <a href={`${render.file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium hover:bg-soft">
            <Download size={15} /> הורדה
          </a>
        </div>
      )}
      {render.status === 'failed' && (
        <div className="text-sm">
          <div className="font-medium">{render.label}</div>
          <div className="mt-0.5 text-bad">{render.error || 'העריכה נכשלה'}</div>
        </div>
      )}
    </div>
  );
}
