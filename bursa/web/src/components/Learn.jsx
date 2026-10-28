// לימוד: מדריך למתחילים + מילון מושגים
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../lib/glossary';
import { DISCLAIMER, GUIDE } from '../lib/guide';
import { Card, Tabs } from './ui';

// מציאת מושג לפי שם (מדויק, אחר כך תחילת שם / אנגלית / הכלה)
export function findTerm(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return -1;
  const tests = [
    (g) => g.term.toLowerCase() === n || g.en.toLowerCase() === n,
    (g) => g.term.toLowerCase().startsWith(n) || g.en.toLowerCase().startsWith(n),
    (g) => g.term.toLowerCase().includes(n) || g.en.toLowerCase().includes(n),
  ];
  for (const test of tests) {
    const i = GLOSSARY.findIndex(test);
    if (i >= 0) return i;
  }
  return -1;
}

function Guide() {
  const [open, setOpen] = useState(() => new Set([GUIDE[0]?.id]));
  const toggle = (id) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  return (
    <div className="space-y-2">
      {GUIDE.map((c, i) => (
        <Card key={c.id} className="p-0">
          <button type="button" onClick={() => toggle(c.id)} aria-expanded={open.has(c.id)} className="flex w-full items-center gap-3 p-4 text-start">
            <span className="text-2xl" aria-hidden="true">{c.emoji}</span>
            <span className="flex-1"><span className="block text-xs text-muted">פרק {i + 1}</span><span className="font-bold">{c.title}</span></span>
            <ChevronDown size={20} className={`text-muted transition ${open.has(c.id) ? 'rotate-180' : ''}`} />
          </button>
          {open.has(c.id) && (
            <div className="space-y-3 border-t border-line px-4 pb-4 pt-3 text-[15px] leading-relaxed">
              {c.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              {c.tips?.length > 0 && (
                <div className="rounded-xl bg-soft p-3">
                  <div className="mb-1 text-sm font-bold">טיפים</div>
                  <ul className="space-y-1 text-sm">{c.tips.map((t, j) => <li key={j} className="flex gap-2"><span aria-hidden="true">💡</span><span>{t}</span></li>)}</ul>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
      <p className="pt-2 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
    </div>
  );
}

function Glossary({ termParam }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);
  const refs = useRef({});

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return GLOSSARY.map((g, i) => ({ g, i })).filter(({ g }) => (cat === 'all' || g.cat === cat)
      && (!n || g.term.toLowerCase().includes(n) || g.en.toLowerCase().includes(n) || g.short.includes(n)));
  }, [q, cat]);

  // קישור למושג מסוים: פותחים וגוללים אליו
  useEffect(() => {
    if (!termParam) return;
    const i = findTerm(termParam);
    if (i < 0) return;
    setQ('');
    setCat('all');
    setOpen(i);
    setTimeout(() => refs.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }, [termParam]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 focus-within:border-accent">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מושג: RSI, דיבידנד, פיזור..." aria-label="חיפוש מושג" className="min-h-11 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted" />
      </div>
      <div className="no-scrollbar -mx-4 my-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {[{ id: 'all', name: 'הכול', emoji: '📚' }, ...GLOSSARY_CATEGORIES].map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${cat === c.id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-muted'}`}>{c.emoji} {c.name}</button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted">{list.length} מושגים</p>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-start">
        {list.map(({ g, i }) => (
          <div key={i} ref={(el) => { refs.current[i] = el; }} className={`rounded-2xl border bg-card ${open === i ? 'border-accent' : 'border-line'}`}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-start gap-3 p-3 text-start">
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline gap-2"><b>{g.term}</b><bdi dir="ltr" className="text-xs text-muted">{g.en}</bdi></span>
                <span className="mt-0.5 block text-sm text-muted">{g.short}</span>
              </span>
              <ChevronDown size={18} className={`mt-1 shrink-0 text-muted transition ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="space-y-2 border-t border-line px-3 pb-3 pt-2 text-sm leading-relaxed">
                <p>{g.long}</p>
                {g.example && <p className="rounded-xl bg-soft p-2.5"><b>דוגמה: </b>{g.example}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted">לא נמצא מושג כזה. נסו מילה אחרת.</p>}
    </div>
  );
}

export default function Learn({ params }) {
  const termParam = params.get('term');
  const [tab, setTab] = useState(termParam ? 'glossary' : 'guide');
  useEffect(() => {
    if (termParam) setTab('glossary');
  }, [termParam]);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-3 text-xl font-bold">לימוד</h1>
      <Tabs tabs={[['guide', 'מדריך למתחילים'], ['glossary', 'מילון מושגים']]} value={tab} onChange={setTab} />
      {tab === 'guide' ? <Guide /> : <Glossary termParam={termParam} />}
    </div>
  );
}
