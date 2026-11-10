import { bytes, count } from '../lib/format.js';

// פס תחתון קבוע: כמה תמונות מסומנות ומה יתפנה
export default function TrashBar({ n, size, busy, onTrash }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-line p-3 pb-[calc(0.75rem+var(--safe-bottom))]">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <div className="flex-1 text-sm">
          {n ? (
            <>
              <b>{count(n)}</b> תמונות מסומנות · יתפנו <b>{bytes(size)}</b>
            </>
          ) : (
            <span className="text-muted">לא סומנו תמונות</span>
          )}
        </div>
        <button
          type="button"
          disabled={!n || busy}
          onClick={onTrash}
          className="px-5 py-3 rounded-xl bg-bad text-white font-bold disabled:opacity-40"
        >
          {busy ? 'רגע...' : '🗑 להעביר לפח'}
        </button>
      </div>
    </div>
  );
}
