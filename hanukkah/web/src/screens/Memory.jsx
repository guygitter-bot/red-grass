import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { SIZES, buildDeck } from '../lib/memory';
import { play } from '../lib/sound';

export default function Memory() {
  const { progress, update } = useApp();
  const [size, setSize] = useState(null);
  const [deck, setDeck] = useState([]);
  const [flipped, setFlipped] = useState([]); // אינדקסים של קלפים הפוכים כרגע
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const saved = useRef(false);

  const start = (key) => {
    saved.current = false;
    setSize(key);
    setDeck(buildDeck(key));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  // בדיקת זוג אחרי שני קלפים הפוכים
  useEffect(() => {
    if (flipped.length !== 2) return undefined;
    const [a, b] = flipped;
    const isMatch = deck[a].id === deck[b].id;
    const t = setTimeout(
      () => {
        if (isMatch) {
          setMatched((m) => [...m, a, b]);
          play('correct');
        }
        setFlipped([]);
      },
      isMatch ? 450 : 950,
    );
    return () => {
      clearTimeout(t);
    };
  }, [flipped, deck]);

  const won = deck.length > 0 && matched.length === deck.length;
  useEffect(() => {
    if (!won || saved.current) return;
    saved.current = true;
    play('win');
    update((p) => {
      const cur = p.memory[size];
      return { ...p, memory: { ...p.memory, [size]: cur > 0 ? Math.min(cur, moves) : moves } };
    });
  }, [won]);

  const flip = (i) => {
    if (flipped.length >= 2 || flipped.includes(i) || matched.includes(i)) return;
    play('tap');
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) setMoves((m) => m + 1);
  };

  if (!size) {
    return (
      <Layout title="זיכרון" back="#/games">
        <p className="mt-0 text-lg">מצאו זוגות של סמלי החג. בחרו גודל:</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(SIZES).map(([k, s]) => (
            <button key={k} onClick={() => start(k)} className="card p-6 text-center hover:border-accent text-ink">
              <div className="text-4xl" aria-hidden="true">🧠</div>
              <div className="text-2xl font-extrabold">{s.label}</div>
              <div className="text-muted">{s.pairs} זוגות</div>
              <div className="text-muted">{progress.memory[k] ? `שיא: ${progress.memory[k]} מהלכים` : 'עוד לא שיחקתם'}</div>
            </button>
          ))}
        </div>
      </Layout>
    );
  }

  const cols = SIZES[size].cols;
  return (
    <Layout title={`זיכרון – ${SIZES[size].label}`} back="#/games">
      <div className="mx-auto" style={{ maxWidth: Math.max(cols * 150, 420) }}>
        <div className="flex items-center justify-between mb-3 font-bold">
          <span>מהלכים: {moves}</span>
          <span className="text-muted">{progress.memory[size] ? `שיא: ${progress.memory[size]}` : ''}</span>
          <button className="btn btn-sm" onClick={() => setSize(null)}>גודל אחר</button>
        </div>
        <div className="grid gap-2 lg:gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {deck.map((c, i) => {
            const open = flipped.includes(i) || matched.includes(i);
            return (
              <button
                key={c.key}
                className={`mcard p-0 border-0 bg-transparent ${open ? 'open' : ''} ${matched.includes(i) ? 'done' : ''}`}
                onClick={() => flip(i)}
                aria-label={open ? c.word : 'קלף הפוך'}
              >
                <div className="mcard-in">
                  <div className="mface front" aria-hidden="true">?</div>
                  <div className="mface back">
                    <span className="text-3xl lg:text-5xl" aria-hidden="true">{c.emoji}</span>
                    <span className="text-xs lg:text-base font-bold text-ink px-1 text-center leading-tight">{c.word}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {won && (
          <div className="card p-5 mt-4 text-center pop" role="status">
            <div className="text-4xl">🎉</div>
            <div className="text-xl font-extrabold">כל הכבוד! סיימתם ב-{moves} מהלכים</div>
            <div className="flex gap-3 justify-center mt-3">
              <button className="btn btn-primary" onClick={() => start(size)}>עוד משחק</button>
              <button className="btn" onClick={() => setSize(null)}>גודל אחר</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
