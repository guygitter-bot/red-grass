import { useRef, useState } from 'react';
import { CheckCircle2, Eye, Loader2, Upload } from 'lucide-react';
import { MAX_VIDEO_BYTES, videoState } from '../lib/videos';

// הצפייה בסרטון (Gemini רואה את התמונה ושומע את הקול): מצב, מה נראה ונשמע, "לצפות בסרטון" והעלאה מהטלפון
export default function WatchSection({ item, onWatch, onUpload }) {
  const [progress, setProgress] = useState(null); // null = לא מעלה עכשיו, אחרת 0..1
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const state = videoState(item);

  async function pick(file) {
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setError('הסרטון גדול מדי (עד 95MB). נסו סרטון קצר יותר.');
      return;
    }
    setError('');
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (e) {
      setError(e.message);
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const btn = 'flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft disabled:opacity-40';
  const uploadButton = (primary) => (
    <button
      onClick={() => fileRef.current?.click()}
      disabled={uploading}
      className={primary ? 'flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-2 text-sm font-medium disabled:opacity-40' : btn}
    >
      <Upload size={16} /> העלאת הסרטון מהטלפון
    </button>
  );

  return (
    <section className="rounded-2xl border border-line bg-page p-3 space-y-2">
      <h3 className="font-bold flex items-center gap-1.5"><Eye size={18} className="text-accent-ink" /> צפייה בסרטון</h3>

      {uploading && (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm text-accent-ink"><Loader2 size={15} className="animate-spin" /> מעלה את הסרטון... {Math.round(progress * 100)}%</p>
          <div className="h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      )}

      {!uploading && state === 'fetching' && (
        <>
          <p className="flex items-center gap-1.5 text-sm text-accent-ink"><Loader2 size={15} className="animate-spin" /> מוריד את הסרטון מהקישור... (עד כמה דקות)</p>
          <div className="flex flex-wrap gap-2">{uploadButton(false)}</div>
        </>
      )}

      {!uploading && state === 'uploaded' && (
        <p className="flex items-center gap-1.5 text-sm text-accent-ink"><Loader2 size={15} className="animate-spin" /> צופה בסרטון ומקשיב לו...</p>
      )}

      {!uploading && state === 'watched' && (
        <>
          <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400"><CheckCircle2 size={16} /> צפיתי בסרטון – ראיתי מה על המסך ושמעתי מה אומרים</p>
          {item.watched && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">מה ראיתי ושמעתי</summary>
              <p className="whitespace-pre-wrap mt-2 leading-relaxed" dir="auto">{item.watched}</p>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={onWatch} className={btn}><Eye size={16} /> לצפות שוב</button>
            {uploadButton(false)}
          </div>
        </>
      )}

      {!uploading && ['need_upload', 'failed'].includes(state) && (
        <>
          <p className="text-sm text-amber-700 dark:text-amber-400">{item.video.error || 'לא הצלחתי לצפות בסרטון.'}</p>
          <div className="flex flex-wrap gap-2">
            {uploadButton(true)}
            <button onClick={onWatch} className={btn}><Eye size={16} /> לנסות שוב</button>
          </div>
          <p className="text-xs text-muted">איך: שומרים את הסרטון בטלפון (בתפריט ⋯ של הסרטון: "שמירה" / "הורדה"; אם אין – הקלטת מסך), ואז בוחרים אותו כאן.</p>
        </>
      )}

      {!uploading && !state && (
        <>
          <p className="text-sm text-muted">עוד לא צפיתי בסרטון עצמו – רק קראתי את הטקסט שלידו.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onWatch} className="flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-2 text-sm font-medium"><Eye size={16} /> לצפות בסרטון</button>
            {uploadButton(false)}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </section>
  );
}
