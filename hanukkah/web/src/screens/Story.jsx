import { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { CHAPTERS } from '../data/story';
import { play } from '../lib/sound';

export default function Story() {
  const { progress, update } = useApp();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const ch = CHAPTERS[i];
  const done = progress.story.includes(i);
  const correct = picked != null && picked === ch.check.correct;

  const go = (n) => {
    setI(n);
    setPicked(null);
    window.scrollTo(0, 0);
  };
  const answer = (idx) => {
    setPicked(idx);
    if (idx === ch.check.correct) {
      play('correct');
      if (!done) update((p) => ({ ...p, story: [...p.story, i] }));
    } else {
      play('wrong');
    }
  };
  const allDone = progress.story.length >= CHAPTERS.length;

  return (
    <Layout title="סיפור החנוכה" back="#/">
      <div className="flex items-center justify-center gap-2 mb-4" aria-label="התקדמות">
        {CHAPTERS.map((c, n) => (
          <button
            key={n}
            onClick={() => go(n)}
            aria-label={`פרק ${n + 1}${progress.story.includes(n) ? ', הושלם' : ''}`}
            className={`w-11 h-11 rounded-full font-extrabold border-2 ${n === i ? 'bg-accent text-accent-ink border-accent' : progress.story.includes(n) ? 'bg-good-soft text-good border-good' : 'bg-card border-line'}`}
          >
            {progress.story.includes(n) && n !== i ? '★' : n + 1}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="night-panel flex items-center justify-center gap-3 py-10 lg:py-20 text-6xl lg:text-8xl" aria-hidden="true">
          {ch.scene.map((e, n) => (
            <span key={n} className="pop" style={{ animationDelay: `${n * 0.12}s`, animationFillMode: 'backwards' }}>{e}</span>
          ))}
        </div>

        <div className="card p-5">
          <div className="text-sm font-bold text-accent">פרק {i + 1} מתוך {CHAPTERS.length}</div>
          <h2 className="text-2xl font-extrabold mt-1 mb-3">{ch.title}</h2>
          {ch.text.map((t, n) => (
            <p key={n} className="mt-0 mb-3 text-lg">{t}</p>
          ))}

          <div className="mt-4 rounded-2xl bg-soft p-4">
            <div className="font-extrabold mb-2">הבנתם? {ch.check.q}</div>
            <div className="flex flex-col gap-2">
              {ch.check.options.map((o, n) => {
                const state = picked === n ? (n === ch.check.correct ? 'ok' : 'no') : '';
                return (
                  <button
                    key={n}
                    disabled={correct}
                    onClick={() => answer(n)}
                    className={`btn justify-start text-start ${state === 'ok' ? 'bg-good-soft! border-good! text-good!' : ''} ${state === 'no' ? 'bg-bad-soft! border-bad! text-bad! shake' : ''}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {picked != null && (
              <p role="status" className={`mt-3 mb-0 font-bold ${correct ? 'text-good' : 'text-bad'}`}>
                {correct ? (done ? 'נכון!' : 'נכון! קיבלתם כוכב ⭐') : 'כמעט, נסו שוב.'}
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-5">
            <button className="btn flex-1" disabled={i === 0} onClick={() => go(i - 1)}>→ הקודם</button>
            {i < CHAPTERS.length - 1 ? (
              <button className="btn btn-primary flex-1" onClick={() => go(i + 1)}>הבא ←</button>
            ) : (
              <a href="#/" className="btn btn-primary flex-1 no-underline">לדף הבית</a>
            )}
          </div>
          {allDone && i === CHAPTERS.length - 1 && (
            <p className="mt-4 mb-0 text-center font-extrabold text-good pop">🎉 סיימתם את כל הסיפור! כל הכבוד!</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
