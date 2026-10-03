import { useState } from 'react';
import { ClipboardPaste, Plus } from 'lucide-react';
import { linkFromText } from '../lib/recipes';

export default function AddLink({ onAdd }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const submit = (value) => {
    const link = linkFromText(value);
    if (!link) {
      setError('הדביקו קישור למתכון או לסרטון');
      return;
    }
    setError('');
    setText('');
    onAdd(link);
  };

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (linkFromText(clip)) submit(clip);
      else {
        setText(clip);
        setError('בלוח אין קישור');
      }
    } catch {
      setError('אין גישה ללוח. הדביקו ידנית בשדה.');
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          inputMode="url"
          placeholder="הדביקו קישור למתכון או לסרטון…"
          className="flex-1 min-w-0 rounded-2xl bg-white text-stone-900 px-4 py-3 outline-none placeholder:text-stone-400 shadow-sm"
          dir="auto"
        />
        {text.trim() ? (
          <button className="rounded-2xl bg-stone-900 text-white px-4 font-bold flex items-center gap-1 shrink-0">
            <Plus size={18} /> הוספה
          </button>
        ) : (
          <button type="button" onClick={paste} className="rounded-2xl bg-white/20 hover:bg-white/30 px-4 font-bold flex items-center gap-1.5 shrink-0">
            <ClipboardPaste size={18} /> הדבקה
          </button>
        )}
      </form>
      {error && <p className="text-sm mt-2 text-white font-medium">{error}</p>}
    </div>
  );
}
