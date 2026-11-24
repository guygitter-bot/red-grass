import { useState } from 'react';
import { Link2, Plus } from 'lucide-react';

// הדבקת קישור לסרטון (או כמה קישורים בבת אחת). טקסט שליד הקישור נשמר כהערה
export default function AddBox({ initial = '', busy, onAdd }) {
  const [value, setValue] = useState(initial);

  async function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    if (await onAdd(value)) setValue('');
  }

  return (
    <form onSubmit={submit} className="bg-card border border-line rounded-2xl p-3 shadow-sm flex items-center gap-2">
      <Link2 size={20} className="text-muted shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="הדביקו קישור לסרטון GTA 6"
        dir="auto"
        className="flex-1 min-w-0 bg-transparent py-2 outline-none placeholder:text-muted"
      />
      <button disabled={busy || !value.trim()} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
        <Plus size={16} /> הוספה
      </button>
    </form>
  );
}
