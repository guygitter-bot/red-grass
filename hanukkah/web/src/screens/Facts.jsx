import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { FACTS } from '../data/facts';

export default function Facts() {
  const { progress, update } = useApp();
  const [i, setI] = useState(0);

  // עובדה שנראתה נחשבת כנקראה
  useEffect(() => {
    if (!progress.facts.includes(i)) update((p) => ({ ...p, facts: [...p.facts, i] }));
  }, [i]);

  return (
    <Layout title="הידעת?" back="#/extras">
      <div className="max-w-xl mx-auto text-center">
        <div className="text-muted font-bold mb-2">עובדה {i + 1} מתוך {FACTS.length}</div>
        <div key={i} className="night-panel px-6 py-10 pop min-h-56 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl" aria-hidden="true">💡</div>
          <p className="m-0 text-xl lg:text-2xl font-bold leading-relaxed" aria-live="polite">{FACTS[i]}</p>
        </div>
        <div className="flex gap-3 mt-4">
          <button className="btn flex-1" disabled={i === 0} onClick={() => setI(i - 1)}>→ הקודמת</button>
          <button className="btn btn-primary flex-1" onClick={() => setI((i + 1) % FACTS.length)}>{i === FACTS.length - 1 ? 'מההתחלה' : 'הבאה ←'}</button>
        </div>
        <button className="btn btn-sm mt-3" onClick={() => setI(Math.floor(Math.random() * FACTS.length))}>🎲 עובדה אקראית</button>
      </div>
    </Layout>
  );
}
