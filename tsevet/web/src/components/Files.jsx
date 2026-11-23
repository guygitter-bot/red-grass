// קבצים בהודעה (תמונה / סרטון / הקלטה) וכרטיס עריכת סרטון ברקע
import { useState } from 'react';
import { Clapperboard, Download, ExternalLink, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

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
const DOC_LABEL = { html: 'דף', svg: 'איור', md: 'מסמך', csv: 'טבלה', json: 'נתונים', txt: 'טקסט', pdf: 'PDF', docx: 'Word', doc: 'Word', xlsx: 'Excel', pptx: 'מצגת' };
function DocView({ file }) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const [show, setShow] = useState(ext === 'html' || ext === 'svg');
  const kb = file.size ? `${Math.max(1, Math.round(file.size / 1024))}KB` : '';
  return (
    <div className="rounded-xl border border-line bg-card p-2.5 text-sm text-ink">
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
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-page px-3 py-1.5 font-medium !text-ink hover:bg-soft">
          <ExternalLink size={15} /> לפתוח
        </a>
        <a href={`${file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-page px-3 py-1.5 font-medium !text-ink hover:bg-soft">
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
  const smart = render.op === 'smart_edit';
  return (
    <div className="rounded-xl border border-line bg-page p-3 text-ink">
      {smart && render.status !== 'done' && <SmartPlan render={render} />}
      {render.status === 'queued' && (
        <div className={`flex items-center gap-2 text-sm ${smart ? 'mt-3' : ''}`}>
          <Spinner />
          <div>
            <div className="font-medium">{render.label}</div>
            <div className="text-xs text-muted">
              {render.report ? 'מפרק… זה לוקח 10-40 דקות, והדוח יופיע כאן לבד' : smart ? 'עורך… עריכה חכמה לוקחת 10-40 דקות, והסרטון יופיע כאן לבד' : 'עורך… זה לוקח כמה דקות'}
            </div>
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
          {smart && render.usd > 0 && <div className="num text-xs text-muted">עלות העריכה: ${render.usd.toFixed(2)}</div>}
        </div>
      )}
      {render.status === 'failed' && (
        <div className={`text-sm ${smart ? 'mt-3' : ''}`}>
          {!smart && <div className="font-medium">{render.label}</div>}
          <div className="mt-0.5 text-bad">{render.error || 'העריכה נכשלה'}</div>
        </div>
      )}
      {render.status === 'cancelled' && <div className="mt-2 text-sm text-muted">בוטל</div>}
    </div>
  );
}

// עריכה חכמה: מה תוכנן, ובהצעה – כפתור אישור (עולה כמה דולרים)
function SmartPlan({ render }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { id: render.id });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };
  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <Clapperboard size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {render.label} · {render.tool}
          </div>
          <div className="text-xs text-muted">
            {render.files} {render.files === 1 ? 'קובץ' : 'קבצים'}
          </div>
          {render.brief && <p className="mt-1 whitespace-pre-line break-words">{render.brief}</p>}
        </div>
      </div>
      {render.status === 'proposed' && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">
            {render.report ? 'Claude Code מפרק את הסרטון ברקע: איך כל שוט צולם או נוצר, ואיך לעשות דומה.' : 'Claude Code עורך את הסרטון ברקע.'} עולה בערך 3-10 דולר (לכל היותר {render.maxUsd}$), לפי האורך. שום דבר לא מתחיל בלי אישור.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/render/approve')}>
              {busy ? 'מתחיל…' : 'לערוך'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/render/cancel')}>
              לא עכשיו
            </Button>
          </div>
        </div>
      )}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
