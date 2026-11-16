// רשימת שיחות: כותרת, זמן, תג Telegram, נקודה מסתובבת כשעובדים. תפריט קטן לשינוי שם ומחיקה
import { useState } from 'react';
import { MoreVertical, Send } from 'lucide-react';
import { api } from '../lib/api';
import { go } from '../lib/route';
import { relTime } from '../lib/format';
import { Button, Sheet, Spinner, inputCls } from './ui';

export default function ConvList({ convs, activeId, refresh, compact }) {
  const [menu, setMenu] = useState(null); // השיחה שהתפריט שלה פתוח
  const [mode, setMode] = useState(null); // 'rename' | 'delete'
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!convs.length) return <p className="p-4 text-center text-sm text-muted">עוד אין שיחות. אפשר להתחיל שיחה חדשה.</p>;

  const close = () => {
    setMenu(null);
    setMode(null);
    setError('');
  };
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
      close();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <>
      <ul className="space-y-1">
        {convs.map((c) => (
          <li key={c.id} className={`group flex items-center rounded-xl ${activeId === c.id ? 'bg-soft' : 'hover:bg-soft'} ${compact ? '' : 'border border-line bg-card'}`}>
            <button onClick={() => go(`/c/${encodeURIComponent(c.id)}`)} className="min-w-0 flex-1 px-3 py-2.5 text-start">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{c.title || 'שיחה חדשה'}</span>
                {c.busy && <Spinner size={12} />}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <span>{relTime(c.at)}</span>
                {c.source === 'tg' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-accent-ink">
                    <Send size={10} /> Telegram
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => {
                setMenu(c);
                setTitle(c.title || '');
              }}
              className="rounded-full p-2 text-muted hover:bg-soft"
              aria-label="עוד"
            >
              <MoreVertical size={18} />
            </button>
          </li>
        ))}
      </ul>

      {menu && !mode && (
        <Sheet title={menu.title || 'שיחה'} onClose={close}>
          <div className="space-y-2">
            <Button kind="ghost" className="w-full" onClick={() => setMode('rename')}>
              שינוי שם
            </Button>
            <Button kind="danger" className="w-full" onClick={() => setMode('delete')}>
              מחיקה
            </Button>
          </div>
        </Sheet>
      )}
      {menu && mode === 'rename' && (
        <Sheet title="שינוי שם" onClose={close}>
          <input className={`${inputCls} mb-3`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={80} />
          {error && <p className="mb-2 text-sm text-bad">{error}</p>}
          <Button className="w-full" disabled={busy || !title.trim()} onClick={() => run(() => api('/app/conv/rename', { id: menu.id, title: title.trim() }))}>
            שמירה
          </Button>
        </Sheet>
      )}
      {menu && mode === 'delete' && (
        <Sheet title="למחוק את השיחה?" onClose={close}>
          <p className="mb-4 text-sm text-muted">"{menu.title || 'שיחה'}" תימחק לגמרי ולא ניתן יהיה לשחזר אותה.</p>
          {error && <p className="mb-2 text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <Button kind="ghost" className="flex-1" onClick={close}>
              ביטול
            </Button>
            <Button
              kind="danger"
              className="flex-1"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api('/app/conv/delete', { id: menu.id });
                  if (activeId === menu.id) go('/');
                })
              }
            >
              מחיקה
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
