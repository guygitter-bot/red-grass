import { useMemo, useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { useStore } from '../App';
import { TYPES } from '../lib/store';
import { dayLabel } from '../lib/dates';
import { parseMessage } from '../lib/parse';
import { Sheet } from './ui';

// הודעה מווטסאפ (מודבקת, או ששותפה לאפליקציה) -> טיוטה שנפתחת בעורך לאישור
export default function ImportSheet({ text: initialText, onClose }) {
  const { edit } = useStore();
  const [text, setText] = useState(initialText || '');
  const draft = useMemo(() => (text.trim() ? parseMessage(text) : null), [text]);

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      // אין הרשאה ללוח – מדביקים ידנית בתיבה
    }
  };

  const next = () => {
    onClose();
    edit(draft);
  };

  return (
    <Sheet
      title="הודעה מווטסאפ"
      onClose={onClose}
      footer={<button onClick={next} disabled={!draft} className="w-full rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">המשך לשמירה</button>}
    >
      <p className="text-sm text-stone-500">מעתיקים הודעה (הזמנה, אירוע, המלצה, קישור) ומדביקים כאן – התאריך, השעה והקישורים יזוהו לבד. בטלפון אפשר גם "שיתוף" מתוך ווטסאפ ישירות לאפליקציה.</p>
      {navigator.clipboard?.readText && (
        <button onClick={paste} className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-sm"><ClipboardPaste size={16} />הדבקה מהלוח</button>
      )}
      <textarea
        autoFocus={!initialText}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="הדביקי כאן את ההודעה..."
        className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-violet-500 text-sm"
      />
      {draft && (
        <div className="mt-3 rounded-2xl bg-violet-50 p-3 text-sm space-y-1">
          <div className="font-bold">{draft.title}</div>
          <div className="text-stone-600">{TYPES[draft.type].emoji} {TYPES[draft.type].label}</div>
          {draft.due && <div className="text-stone-600">🗓️ {dayLabel(draft.due)}{draft.time ? ` ב-${draft.time}` : ''}{draft.remind != null ? ' · 🔔 תזכורת חצי שעה לפני' : ''}</div>}
          {draft.links.map((l) => <div key={l.url} dir="ltr" className="text-violet-700 truncate text-left">{l.url}</div>)}
        </div>
      )}
    </Sheet>
  );
}
