import { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { LEVEL_INFO, QUESTIONS } from '../data/quiz';
import { pickN, shuffle } from '../lib/util';
import { quizStars } from '../lib/progress';
import { play } from '../lib/sound';

const ROUND = 8;

// מכינים סיבוב: 8 שאלות אקראיות, והתשובות מעורבבות
function buildRound(level) {
  return pickN(QUESTIONS[level], ROUND).map((q) => ({
    q: q.q,
    explain: q.explain,
    options: shuffle(q.options.map((text, i) => ({ text, ok: i === q.correct }))),
  }));
}

export default function Quiz() {
  const { progress, update } = useApp();
  const [level, setLevel] = useState(null);
  const [round, setRound] = useState([]);
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const start = (key) => {
    setLevel(key);
    setRound(buildRound(key));
    setN(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const answer = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    if (round[n].options[idx].ok) {
      setScore((s) => s + 1);
      play('correct');
    } else {
      play('wrong');
    }
  };

  const next = () => {
    if (n + 1 < ROUND) {
      setN(n + 1);
      setPicked(null);
      return;
    }
    // סוף סיבוב: שומרים שיא וכוכבים
    const stars = quizStars(score);
    update((p) => {
      const cur = p.quiz[level];
      return {
        ...p,
        quiz: { ...p.quiz, [level]: { best: Math.max(cur.best, score), stars: Math.max(cur.stars, stars), rounds: cur.rounds + 1 } },
      };
    });
    play(stars > 0 ? 'win' : 'tap');
    setFinished(true);
  };

  // בחירת רמה
  if (!level) {
    return (
      <Layout title="חידון" back="#/">
        <p className="mt-0 text-lg">בכל סיבוב 8 שאלות. בחרו רמה:</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {LEVEL_INFO.map((l) => {
            const b = progress.quiz[l.key];
            return (
              <button key={l.key} onClick={() => start(l.key)} className="card p-6 text-center hover:border-accent text-ink">
                <div className="text-5xl" aria-hidden="true">{l.icon}</div>
                <div className="text-2xl font-extrabold mt-2">{l.label}</div>
                <div className="text-muted mt-1">{b.rounds ? `שיא: ${b.best} מתוך ${ROUND}` : 'עוד לא שיחקתם'}</div>
                <div className="text-2xl mt-1 text-gold" aria-label={`${b.stars} כוכבים`}>{'★'.repeat(b.stars)}{'☆'.repeat(3 - b.stars)}</div>
              </button>
            );
          })}
        </div>
      </Layout>
    );
  }

  if (finished) {
    const stars = quizStars(score);
    const info = LEVEL_INFO.find((l) => l.key === level);
    return (
      <Layout title="חידון" back="#/">
        <div className="card p-8 text-center max-w-xl mx-auto pop">
          <div className="text-6xl">{stars === 3 ? '🏆' : stars > 0 ? '🌟' : '💪'}</div>
          <h2 className="text-3xl font-extrabold my-2">{score} מתוך {ROUND}</h2>
          <div className="text-4xl text-gold" aria-label={`${stars} כוכבים`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <p className="text-lg">
            {stars === 3 ? 'מדהים! אתם יודעים הכול על חנוכה.' : stars > 0 ? 'כל הכבוד! אפשר לנסות שוב ולשפר.' : 'לא נורא, קראו עוד על החג ונסו שוב.'}
          </p>
          <p className="text-muted mt-0">שיא ברמת {info.label}: {progress.quiz[level].best} מתוך {ROUND}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="btn btn-primary" onClick={() => start(level)}>עוד סיבוב</button>
            <button className="btn" onClick={() => setLevel(null)}>בחירת רמה</button>
          </div>
        </div>
      </Layout>
    );
  }

  const cur = round[n];
  return (
    <Layout title={`חידון – ${LEVEL_INFO.find((l) => l.key === level).label}`} back="#/quiz">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between text-muted font-bold mb-2">
          <span>שאלה {n + 1} מתוך {ROUND}</span>
          <span>נקודות: {score}</span>
        </div>
        <div className="h-3 rounded-full bg-line overflow-hidden mb-4" aria-hidden="true">
          <div className="h-full bg-accent transition-all" style={{ width: `${(n / ROUND) * 100}%` }} />
        </div>
        <div className="card p-5">
          <h2 className="text-xl lg:text-2xl font-extrabold mt-0 mb-4">{cur.q}</h2>
          <div className="flex flex-col gap-3">
            {cur.options.map((o, i) => {
              const show = picked != null;
              const cls = show ? (o.ok ? 'bg-good-soft! border-good! text-good!' : picked === i ? 'bg-bad-soft! border-bad! text-bad! shake' : 'opacity-60') : '';
              return (
                <button key={i} disabled={show} onClick={() => answer(i)} className={`btn justify-start text-start text-lg min-h-14 py-2 ${cls}`}>
                  <span className="font-extrabold text-muted" aria-hidden="true">{['א', 'ב', 'ג', 'ד'][i]}.</span>
                  {o.text}
                  {show && o.ok && <span aria-hidden="true"> ✓</span>}
                </button>
              );
            })}
          </div>
          {picked != null && (
            <div role="status" className="mt-4 rounded-2xl bg-soft p-4 pop">
              <div className={`font-extrabold ${cur.options[picked].ok ? 'text-good' : 'text-bad'}`}>{cur.options[picked].ok ? 'נכון! 🎉' : 'לא נכון, ננסה בפעם הבאה.'}</div>
              <p className="m-0 mt-1">{cur.explain}</p>
              <button className="btn btn-primary mt-3 w-full" onClick={next}>{n + 1 < ROUND ? 'השאלה הבאה ←' : 'לסיכום ←'}</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
