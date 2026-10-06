import { Loader2 } from 'lucide-react';
import { countText } from '../lib/library';

// אריח קטגוריה במסך הראשי
export default function CategoryTile({ emoji, name, count, previews = [], busy, icon, onOpen }) {
  return (
    <button onClick={onOpen} className="text-start bg-card border border-line rounded-2xl p-4 shadow-sm hover:border-accent/50 transition flex flex-col gap-1 min-w-0">
      <span className="text-4xl leading-none mb-1">{icon || emoji}</span>
      <span className="font-bold leading-snug line-clamp-2" dir="auto">{name}</span>
      <span className="text-sm text-muted">{countText(count)}</span>
      {busy && (
        <span className="flex items-center gap-1.5 text-sm text-accent-ink">
          <Loader2 size={14} className="animate-spin" /> ממפה...
        </span>
      )}
      {previews.map((t) => (
        <span key={t} className="text-xs text-muted/70 truncate" dir="auto">{t}</span>
      ))}
    </button>
  );
}
