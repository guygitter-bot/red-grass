// הצגת מרקדאון פשוט כאלמנטים של React (בלי HTML גולמי)
import { parseMd } from '../lib/md';

function Inline({ parts }) {
  return parts.map((p, i) => {
    if (p.t === 'b') return <strong key={i}>{p.text}</strong>;
    if (p.t === 'code') return <code key={i} dir="ltr" className="rounded bg-soft px-1 text-[0.9em]">{p.text}</code>;
    if (p.t === 'a') return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="[overflow-wrap:anywhere] text-accent-ink underline">{p.text}</a>;
    return p.text;
  });
}

export default function Md({ text }) {
  const blocks = parseMd(text);
  return (
    <div className="space-y-1 leading-relaxed">
      {blocks.map((b, i) => {
        if (b.type === 'gap') return <div key={i} className="h-1.5" />;
        if (b.type === 'li') return <div key={i} className="flex gap-2"><span aria-hidden="true">•</span><span className="min-w-0"><Inline parts={b.inline} /></span></div>;
        if (b.type === 'h') return <div key={i} className="font-bold"><Inline parts={b.inline} /></div>;
        return <div key={i}><Inline parts={b.inline} /></div>;
      })}
    </div>
  );
}
