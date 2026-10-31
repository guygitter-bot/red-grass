import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, Download, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react';
import { domainOf, isWaiting, sizeText } from '../lib/library';
import { downloadZip } from '../lib/zip';

// כפתור העתקה עם משוב "הועתק ✓" ל-2 שניות
function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => setDone(false), 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [done]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
    } catch {
      window.prompt('העתיקו מכאן:', text);
    }
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm hover:bg-soft">
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? 'הועתק ✓' : 'העתקה'}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-lg">{title}</h3>
      {children}
    </section>
  );
}

function Skill({ skill }) {
  const [show, setShow] = useState(false);
  return (
    <div className="border border-line rounded-2xl p-3 space-y-2 bg-page">
      <div className="min-w-0">
        <h4 className="font-bold leading-snug" dir="auto">{skill.title}</h4>
        <p className="text-xs text-muted font-mono" dir="ltr">{skill.name}</p>
      </div>
      <p className="text-sm" dir="auto">{skill.description}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadZip(`${skill.name}.zip`, [{ name: `${skill.name}/SKILL.md`, text: skill.file }])}
          className="flex items-center gap-1.5 rounded-xl bg-accent text-white px-3 py-1.5 text-sm font-medium"
        >
          <Download size={15} /> הורדה (zip)
        </button>
        <CopyButton text={skill.file} />
      </div>
      {skill.instructions && (
        <div>
          <button onClick={() => setShow(!show)} className="flex items-center gap-1 text-sm text-accent-ink">
            <ChevronDown size={15} className={show ? 'rotate-180' : ''} /> {show ? 'הסתרת ההוראות' : 'הצגת ההוראות'}
          </button>
          {show && <p className="mt-2 text-sm whitespace-pre-wrap bg-card border border-line rounded-xl p-3" dir="auto">{skill.instructions}</p>}
        </div>
      )}
    </div>
  );
}

function Prompt({ p }) {
  return (
    <div className="border border-line rounded-2xl p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        <h4 className="font-bold leading-snug flex-1 min-w-0" dir="auto">{p.title}</h4>
        {p.tool && <span className="rounded-full bg-soft text-accent-ink px-2 py-0.5 text-xs shrink-0" dir="auto">{p.tool}</span>}
        <span className="text-xs text-muted shrink-0">{p.fromSource ? 'מהחומר' : 'נכתב לפי השיטה'}</span>
      </div>
      {p.purpose && <p className="text-sm text-muted" dir="auto">{p.purpose}</p>}
      <div className="bg-page border border-line rounded-xl p-3 font-mono text-sm whitespace-pre-wrap" dir="auto">{p.prompt}</div>
      <CopyButton text={p.prompt} />
    </div>
  );
}

// פרטי פריט לימוד: סקילים להורדה, פרומפטים, צעדים ולקחים
export default function LearnSheet({ item, onClose, onUpdate, onDelete, onRetry, onDownload }) {
  const [note, setNote] = useState(item.note || '');
  const learn = item.learn;
  const skills = learn?.skills || [];
  const prompts = learn?.prompts || [];
  const steps = learn?.steps || [];
  const lessons = learn?.lessons || [];

  useEffect(() => {
    setNote(item.note || '');
  }, [item.id, item.note]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end lg:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card w-full lg:max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <h2 className="text-xl font-bold leading-snug flex-1" dir="auto">{item.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-soft" aria-label="סגירה"><X size={20} /></button>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.kind === 'link' && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft">
              <ExternalLink size={16} /> פתיחת הקישור ({domainOf(item.url)})
            </a>
          )}
          {item.kind === 'file' && (
            <button onClick={() => onDownload(item)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft">
              <Download size={16} /> פתיחת הקובץ ({sizeText(item.file.size)})
            </button>
          )}
        </div>

        {isWaiting(item) && <p className="text-accent-ink text-sm">לומד מהחומר... זה יכול לקחת כמה דקות.</p>}
        {item.status === 'failed' && <p className="text-red-600 dark:text-red-400 text-sm">{item.error || 'הלימוד נכשל'}</p>}

        {learn && learn.coverage !== 'full' && (
          <div className="bg-soft rounded-xl p-3 text-sm space-y-1">
            <p className="flex items-center gap-1.5 font-bold"><AlertTriangle size={16} className="shrink-0" /> כדאי לבדוק – לא קראתי את כל החומר</p>
            {learn.coverageNote && <p dir="auto">{learn.coverageNote}</p>}
          </div>
        )}
        {learn && learn.coverage === 'full' && learn.coverageNote && <p className="text-xs text-muted" dir="auto">{learn.coverageNote}</p>}

        {item.summary && <p className="leading-relaxed" dir="auto">{item.summary}</p>}

        {skills.length > 0 && (
          <Section title="סקילים ל-Claude">
            {skills.map((s) => <Skill key={s.name} skill={s} />)}
            <p className="text-xs text-muted">איך מוסיפים: ב-claude.ai ← הגדרות (Settings) ← Capabilities ← Skills ← Upload skill, ובוחרים את קובץ ה-zip.</p>
          </Section>
        )}

        {prompts.length > 0 && (
          <Section title="פרומפטים">
            {prompts.map((p, i) => <Prompt key={i} p={p} />)}
          </Section>
        )}

        {steps.length > 0 && (
          <Section title="צעד אחר צעד">
            <ol className="list-decimal ps-6 space-y-3">
              {steps.map((s, i) => (
                <li key={i}>
                  <p className="font-bold" dir="auto">{s.title}</p>
                  {s.detail && <p className="text-sm whitespace-pre-wrap" dir="auto">{s.detail}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {lessons.length > 0 && (
          <Section title="מה לומדים מזה">
            <ul className="list-disc ps-5 space-y-1 text-sm">
              {lessons.map((l, i) => <li key={i} dir="auto">{l}</li>)}
            </ul>
          </Section>
        )}

        <label className="block">
          <span className="text-sm text-muted">הערה שלי</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.note || '')) onUpdate({ note });
            }}
            rows={2}
            placeholder="למשל: לנסות בעבודה"
            className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2.5 outline-none focus:border-accent resize-none"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onRetry} disabled={isWaiting(item)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft disabled:opacity-40">
            <RefreshCw size={16} /> ללמוד מחדש
          </button>
          <button
            onClick={() => {
              if (window.confirm('למחוק את הפריט?')) onDelete();
            }}
            className="ms-auto flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-soft"
          >
            <Trash2 size={16} /> מחיקה
          </button>
        </div>
      </div>
    </div>
  );
}
