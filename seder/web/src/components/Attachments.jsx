import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, ImagePlus, Loader2, Paperclip, X } from 'lucide-react';
import { useStore } from '../App';
import { attachmentsOf, fileSize, isImage } from '../lib/store';
import { attachFile, fileUrl } from '../lib/files';

// תמונה קטנה – נטענת מהמכשיר (אם כבר נשמרה) או מהשרת
function Thumb({ file, onOpen }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fileUrl(file).then((u) => live && setSrc(u), () => live && setFailed(true));
    return () => { live = false; };
  }, [file]);
  return (
    <button type="button" onClick={onOpen} aria-label={`פתיחת ${file.name}`} className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
      {src ? <img src={src} alt={file.name} className="w-full h-full object-cover" /> : failed ? <ImagePlus size={22} /> : <Loader2 size={22} className="animate-spin" />}
    </button>
  );
}

// תמונה במסך מלא, עם הורדה
function Viewer({ file, onClose }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    fileUrl(file).then(setSrc, () => onClose());
    // Escape סוגר רק את התמונה, לא את עורך המשימה שמתחת
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [file, onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" dir="rtl" onClick={onClose}>
      <div className="flex items-center gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)] text-white">
        <span className="flex-1 min-w-0 truncate text-sm">{file.name}</span>
        {src && <a href={src} download={file.name} onClick={(e) => e.stopPropagation()} aria-label="הורדה" className="p-2 rounded-full bg-white/10"><Download size={20} /></a>}
        <button aria-label="סגירה" onClick={onClose} className="p-2 rounded-full bg-white/10"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        {src ? <img src={src} alt={file.name} onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg" /> : <Loader2 size={32} className="text-white animate-spin" />}
      </div>
    </div>
  );
}

// קבצים ותמונות במשימה (בעורך). files = מה שבמשימה, onChange מקבל את הרשימה החדשה
export default function Attachments({ files, onChange }) {
  const { syncStatus } = useStore();
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const closeViewer = useCallback(() => setViewing(null), []);
  const list = attachmentsOf({ attachments: files });
  const images = list.filter(isImage);
  const others = list.filter((f) => !isImage(f));
  const canUpload = syncStatus !== 'off';

  const add = async (e) => {
    const chosen = [...(e.target.files || [])];
    e.target.value = '';
    if (!chosen.length) return;
    setError('');
    setBusy((n) => n + chosen.length);
    const added = [];
    for (const f of chosen) {
      try {
        added.push(await attachFile(f));
      } catch (err) {
        setError(err.message || 'ההעלאה נכשלה');
      }
      setBusy((n) => n - 1);
    }
    if (added.length) onChange((current) => [...attachmentsOf({ attachments: current }), ...added]);
  };

  const open = async (f) => {
    if (isImage(f)) return setViewing(f);
    try {
      const a = document.createElement('a');
      a.href = await fileUrl(f);
      a.download = f.name;
      a.click();
    } catch {
      setError('אי אפשר לפתוח את הקובץ כרגע – צריך אינטרנט');
    }
  };
  const remove = (id) => onChange((current) => attachmentsOf({ attachments: current }).filter((x) => x.id !== id));
  const pick = 'flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-100 text-violet-700 py-2 text-sm cursor-pointer';

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((f) => (
            <div key={f.id} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200">
              <Thumb file={f} onOpen={() => open(f)} />
              <button type="button" aria-label={`הסרת ${f.name}`} onClick={() => remove(f.id)} className="absolute top-1 left-1 rounded-full bg-black/55 text-white p-1"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {others.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
          <FileText size={18} className="text-violet-600 shrink-0" />
          <button type="button" onClick={() => open(f)} className="flex-1 min-w-0 text-right">
            <span className="block truncate text-violet-700 underline">{f.name}</span>
            <span className="block text-xs text-stone-500">{fileSize(f.size)}</span>
          </button>
          <button type="button" aria-label={`הסרת ${f.name}`} onClick={() => remove(f.id)} className="text-stone-400"><X size={16} /></button>
        </div>
      ))}
      {busy > 0 && <p className="flex items-center gap-1.5 text-xs text-violet-700"><Loader2 size={14} className="animate-spin" />מעלה {busy > 1 ? `${busy} קבצים` : 'קובץ'}...</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {canUpload ? (
        <div className="flex gap-2">
          <label className={pick}>
            <ImagePlus size={18} />תמונה
            <input type="file" accept="image/*" multiple onChange={add} className="hidden" />
          </label>
          <label className={pick}>
            <Paperclip size={18} />קובץ
            <input type="file" multiple onChange={add} className="hidden" />
          </label>
        </div>
      ) : (
        <p className="text-xs text-stone-500">כדי לצרף תמונות וקבצים צריך להיות מחובר לסנכרון (הקבצים נשמרים בשרת).</p>
      )}
      {viewing && <Viewer file={viewing} onClose={closeViewer} />}
    </div>
  );
}
