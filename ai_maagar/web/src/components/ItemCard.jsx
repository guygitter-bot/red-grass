import { AlertCircle, FileText, Globe, Loader2, StickyNote } from 'lucide-react';
import { domainOf, isWaiting } from '../lib/library';

// כרטיס של פריט ברשימה
export default function ItemCard({ item, emoji, onOpen }) {
  const waiting = isWaiting(item);
  const Icon = item.kind === 'file' ? FileText : item.kind === 'text' ? StickyNote : Globe;
  const source = item.kind === 'link' ? domainOf(item.url) : item.kind === 'file' ? item.file?.name : 'טקסט';
  return (
    <button onClick={() => onOpen(item.id)} className="w-full text-start bg-card border border-line rounded-2xl p-4 shadow-sm hover:border-accent/50 transition flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted min-w-0">
        <Icon size={14} className="shrink-0" />
        <span className="truncate" dir="auto">{source}</span>
        {item.type && <span className="ms-auto shrink-0 rounded-full bg-soft text-accent-ink px-2 py-0.5">{item.type}</span>}
      </div>
      <h3 className="font-bold leading-snug line-clamp-2" dir="auto">{item.title}</h3>
      {waiting && (
        <p className="flex items-center gap-1.5 text-sm text-accent-ink">
          <Loader2 size={15} className="animate-spin" /> ממפה את החומר...
        </p>
      )}
      {item.status === 'failed' && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={15} /> {item.error || 'המיפוי נכשל'}
        </p>
      )}
      {item.summary && <p className="text-sm text-muted line-clamp-3">{item.summary}</p>}
      {item.category && (
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <span className="text-xs rounded-full border border-line px-2 py-0.5">{emoji} {item.category}</span>
          {(item.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="text-xs text-muted px-1 py-0.5" dir="auto">#{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}
