// קבצים בהודעה (תמונה / סרטון / הקלטה) וכרטיס עריכת סרטון ברקע
import { Download } from 'lucide-react';
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
  return null;
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
