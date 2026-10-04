import { useEffect, useState } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { useStore } from '../App';
import { addTask } from '../lib/store';
import { parseQuick } from '../lib/parse';

// חלון שעולה מלמטה
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center lg:p-6" dir="rtl">
      <div className="absolute inset-0 bg-stone-900/40" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white rounded-t-3xl shadow-2xl lg:max-w-2xl lg:max-h-[88vh] lg:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="סגירה" onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"><X size={22} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-4 flex-1">{children}</div>
        {footer && <div className="border-t border-stone-100 px-5 pt-3 pb-safe lg:pb-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Section({ title, action, children }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-stone-400 bg-white rounded-2xl border border-dashed border-stone-200 p-4 text-center">{children}</p>;
}

// שורת הוספה מהירה: "להתקשר לרופא מחר ב10 !" -> משימה עם תאריך, שעה וחשיבות
export function QuickAdd({ placeholder, defaults = {} }) {
  const { act } = useStore();
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const parsed = parseQuick(text);
    act(addTask, { ...defaults, ...parsed });
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 bg-white rounded-2xl border border-violet-200 shadow-sm pr-4 pl-1.5 py-1.5 focus-within:border-violet-500">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className="flex-1 bg-transparent outline-none py-1.5 placeholder:text-stone-400"
      />
      <button aria-label="הוספה" disabled={!text.trim()} className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-30">
        <ArrowUp size={20} />
      </button>
    </form>
  );
}

export function Chip({ active, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition ${active ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-600 border-stone-200'} ${className}`}>
      {children}
    </button>
  );
}
