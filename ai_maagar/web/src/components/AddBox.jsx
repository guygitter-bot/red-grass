import { useRef, useState } from 'react';
import { Link2, Paperclip, Plus } from 'lucide-react';

// הדבקת קישורים / טקסט, או העלאת קבצים (גם גרירה במחשב)
export default function AddBox({ initial = '', busy, onAdd, onFiles }) {
  const [value, setValue] = useState(initial);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    if (await onAdd(value)) setValue('');
  }

  function drop(e) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) onFiles([...e.dataTransfer.files]);
    else {
      const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (text) setValue((v) => (v ? `${v}\n${text}` : text));
    }
  }

  return (
    <form
      onSubmit={submit}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={drop}
      className={`bg-card border rounded-2xl p-3 shadow-sm transition ${drag ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}
    >
      <div className="flex items-start gap-2">
        <Link2 size={20} className="text-muted mt-2.5 shrink-0" />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          rows={value.includes('\n') ? 3 : 1}
          placeholder="הדביקו קישור, או כתבו טיפ לשמירה"
          className="flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-muted min-h-[2.5rem]"
        />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft">
          <Paperclip size={16} /> העלאת קובץ
        </button>
        <span className="hidden lg:inline text-xs text-muted">או גררו לכאן קבצים</span>
        <button disabled={busy || !value.trim()} className="ms-auto flex items-center gap-1.5 rounded-xl bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
          <Plus size={16} /> הוספה
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.csv,.json,.html,image/*,application/pdf,text/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files]);
          e.target.value = '';
        }}
      />
    </form>
  );
}
