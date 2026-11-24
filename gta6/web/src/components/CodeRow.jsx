import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// שורת קוד: הקוד (משמאל לימין), מה הוא עושה, פלטפורמה, והעתקה
export default function CodeRow({ code, from, onFrom }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // אין הרשאה להעתקה – לא נורא
    }
  }

  return (
    <li className="bg-page border border-line rounded-xl p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <code className="block font-mono font-bold text-accent-ink break-words" dir="ltr">{code.code}</code>
        {code.effect && <p className="text-sm" dir="auto">{code.effect}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {code.platform && code.platform !== 'לא ידוע' && <span className="rounded-full border border-line px-2 py-0.5">{code.platform}</span>}
          {from && (
            <button onClick={onFrom} className="underline underline-offset-2 truncate max-w-full text-start" dir="auto">מתוך: {from}</button>
          )}
        </div>
      </div>
      <button onClick={copy} className="shrink-0 p-2 rounded-lg border border-line hover:bg-soft" aria-label="העתקת הקוד">
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </button>
    </li>
  );
}
