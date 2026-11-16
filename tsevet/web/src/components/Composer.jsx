// שורת הכתיבה בתחתית הצ'אט: טקסט, צירוף קבצים עם התקדמות, בחירת מי עונה, שליחה
import { useRef, useState } from 'react';
import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { MAX_FILES, checkFile, uploadFile } from '../lib/media';
import { Spinner } from './ui';

const isDesktop = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

export default function Composer({ agents, to, setTo, onSend, sending }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]); // { key, name, kind, progress, id?, error? }
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const areaRef = useRef(null);

  const uploading = items.some((it) => !it.id && !it.error);
  const ready = items.filter((it) => it.id);
  const canSend = !uploading && !sending && (text.trim() || ready.length > 0);

  const patch = (key, p) => setItems((cur) => cur.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const addFiles = (list) => {
    setNotice('');
    const files = [...list];
    const room = MAX_FILES - items.length;
    if (files.length > room) setNotice(`אפשר לצרף עד ${MAX_FILES} קבצים להודעה`);
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = `${Date.now()}-${Math.random()}`;
      const bad = checkFile(file);
      if (bad) {
        setNotice(bad);
        continue;
      }
      setItems((cur) => [...cur, { key, name: file.name, progress: 0 }]);
      uploadFile(file, (p) => patch(key, { progress: p }))
        .then((r) => patch(key, { id: r.id, progress: 1 }))
        .catch((e) => patch(key, { error: e.message }));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const grow = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const send = async () => {
    if (!canSend) return;
    const t = text.trim();
    const ids = ready.map((it) => it.id);
    setText('');
    setItems([]);
    requestAnimationFrame(grow);
    const ok = await onSend(t, ids);
    if (!ok) {
      // לא נשלח – מחזירים את מה שנכתב
      setText(t);
    }
  };

  return (
    <div className="px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {notice && <p className="mb-1 text-xs text-bad">{notice}</p>}
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {items.map((it) => (
            <span key={it.key} className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${it.error ? 'border-bad text-bad' : 'border-line bg-soft'}`} title={it.error || it.name}>
              {!it.id && !it.error && <Spinner size={10} />}
              <span className="truncate">{it.error || it.name}</span>
              {!it.id && !it.error && <span className="num text-muted">{Math.round(it.progress * 100)}%</span>}
              <button onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))} aria-label="הסרה">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
        <label htmlFor="to">מי עונה:</label>
        <select id="to" value={to || ''} onChange={(e) => setTo(e.target.value || null)} className="rounded-lg border border-line bg-page px-2 py-1 text-xs text-ink">
          <option value="">כל הצוות</option>
          {agents.map((a) => (
            <option key={a.key} value={a.key}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} className="rounded-full p-2.5 text-muted hover:bg-soft" aria-label="צירוף קובץ">
          <Paperclip size={22} />
        </button>
        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && isDesktop()) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="כתבו הודעה…"
          className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-line bg-page px-3.5 py-2.5 text-base outline-none focus:border-accent"
        />
        <button onClick={send} disabled={!canSend} className="rounded-full bg-accent p-2.5 text-white disabled:opacity-40" aria-label="שליחה">
          <SendHorizontal size={22} className="rotate-180" />
        </button>
      </div>
    </div>
  );
}
