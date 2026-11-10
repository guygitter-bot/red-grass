import { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { RIDDLES } from '../data/riddles';
import { play } from '../lib/sound';

export default function Riddles() {
  const { progress, update } = useApp();
  const [open, setOpen] = useState([]);

  const reveal = (i) => {
    if (open.includes(i)) return;
    setOpen([...open, i]);
    play('tap');
    if (!progress.riddles.includes(i)) update((p) => ({ ...p, riddles: [...p.riddles, i] }));
  };

  return (
    <Layout title="חידות" back="#/extras">
      <p className="mt-0 text-lg">חשבו על התשובה, ואז לחצו כדי לגלות.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {RIDDLES.map((r, i) => {
          const shown = open.includes(i);
          return (
            <div key={i} className="card p-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <span className="text-2xl" aria-hidden="true">🧩</span>
                <p className="m-0 font-bold text-lg">{r.q}</p>
              </div>
              {shown ? (
                <div className="rounded-xl bg-good-soft text-good font-extrabold text-lg px-4 py-2 pop" role="status">התשובה: {r.a}</div>
              ) : (
                <button className="btn btn-primary" onClick={() => reveal(i)}>גלו את התשובה</button>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
