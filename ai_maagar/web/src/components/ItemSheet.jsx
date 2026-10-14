import { useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import { domainOf, isWaiting, sizeText } from '../lib/library';

const NEW = '__new__';

// פרטי פריט: תקציר, נקודות, קישור / קובץ, הערה, העברה לקטגוריה אחרת, מיפוי מחדש ומחיקה
export default function ItemSheet({ item, categories, onClose, onUpdate, onDelete, onRetry, onDownload }) {
  const [note, setNote] = useState(item.note || '');

  useEffect(() => {
    setNote(item.note || '');
  }, [item.id, item.note]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function changeCategory(value) {
    if (value !== NEW) return onUpdate({ category: value });
    const name = window.prompt('שם הקטגוריה החדשה')?.trim();
    if (name) onUpdate({ category: name });
  }

  const known = categories.some((c) => c.name === item.category);

  return (
    <div className="fixed inset-0 z-40 flex items-end lg:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card w-full lg:max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <h2 className="text-xl font-bold leading-snug flex-1" dir="auto">{item.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-soft" aria-label="סגירה"><X size={20} /></button>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.kind === 'link' && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-2 text-sm font-medium">
              <ExternalLink size={16} /> פתיחת הקישור ({domainOf(item.url)})
            </a>
          )}
          {item.kind === 'file' && (
            <button onClick={() => onDownload(item)} className="flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-2 text-sm font-medium">
              <Download size={16} /> פתיחת הקובץ ({sizeText(item.file.size)})
            </button>
          )}
          {item.type && <span className="rounded-full bg-soft text-accent-ink px-3 py-2 text-sm">{item.type}</span>}
        </div>

        {isWaiting(item) && <p className="text-accent-ink text-sm">ממפה את החומר... זה לוקח בדרך כלל פחות מדקה.</p>}
        {item.status === 'failed' && <p className="text-red-600 dark:text-red-400 text-sm">{item.error || 'המיפוי נכשל'}</p>}

        {item.summary && <p className="leading-relaxed">{item.summary}</p>}
        {item.points?.length > 0 && (
          <ul className="list-disc ps-5 space-y-1 text-sm">
            {item.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {item.kind === 'text' && <p className="whitespace-pre-wrap text-sm bg-page rounded-xl p-3 border border-line" dir="auto">{item.text}</p>}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => <span key={t} className="text-xs text-muted rounded-full border border-line px-2 py-0.5" dir="auto">#{t}</span>)}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-muted">קטגוריה</span>
          <select
            value={item.category || ''}
            onChange={(e) => changeCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2.5 outline-none focus:border-accent"
          >
            {!item.category && <option value="">עוד לא נקבעה</option>}
            {item.category && !known && <option value={item.category}>{item.category}</option>}
            {categories.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
            <option value={NEW}>+ קטגוריה חדשה...</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-muted">הערה שלי</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.note || '')) onUpdate({ note });
            }}
            rows={2}
            placeholder="למשל: לנסות בעבודה"
            className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2.5 outline-none focus:border-accent resize-none"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onRetry} disabled={isWaiting(item)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft disabled:opacity-40">
            <RefreshCw size={16} /> מיפוי מחדש
          </button>
          <button
            onClick={() => {
              if (window.confirm('למחוק את הפריט?')) onDelete();
            }}
            className="ms-auto flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-soft"
          >
            <Trash2 size={16} /> מחיקה
          </button>
        </div>
      </div>
    </div>
  );
}
