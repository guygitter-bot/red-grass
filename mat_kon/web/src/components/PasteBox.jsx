import { useState } from 'react';
import { ClipboardPaste, ExternalLink, Loader2 } from 'lucide-react';

// לקישור שלא הצלחנו לקרוא (קבוצה סגורה, מתכון רק בתגובות): פותחים את הפוסט באפליקציה שבה מחוברים,
// מעתיקים את הטקסט או את התגובה עם המתכון, ומדביקים כאן. הקישור המקורי נשאר בראש המתכון.
export default function PasteBox({ url, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-800 px-3 py-1.5 text-sm font-medium">
        <ClipboardPaste size={15} /> הדבקת טקסט מהפוסט
      </button>
    );
  }

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      setError('אין גישה ללוח. הדביקו ידנית בשדה.');
    }
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit(text.trim());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl bg-stone-50 p-2.5 space-y-2">
      <p className="text-xs text-stone-600">
        פתחו את הפוסט (שם אתם מחוברים), העתיקו את הטקסט או את התגובה עם המתכון, והדביקו כאן.
      </p>
      <div className="flex gap-2 text-sm">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-700 font-medium">
          <ExternalLink size={14} /> פתיחת הפוסט
        </a>
        <button onClick={paste} className="inline-flex items-center gap-1 text-orange-700 font-medium">
          <ClipboardPaste size={14} /> הדבקה מהלוח
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        dir="auto"
        placeholder="הטקסט של הפוסט או התגובה עם המצרכים ואופן ההכנה"
        className="w-full rounded-xl border border-stone-200 bg-white p-2 text-sm outline-none focus:border-orange-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy || text.trim().length < 20}
          onClick={submit}
          className="flex-1 rounded-xl bg-orange-500 text-white text-sm font-bold py-2 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} בניית מתכון מהטקסט
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl bg-stone-200 px-3 text-sm">ביטול</button>
      </div>
    </div>
  );
}
