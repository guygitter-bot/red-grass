import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { WORDS } from '../data/words';
import { scrambleWord } from '../lib/scramble';
import { shuffle } from '../lib/util';
import { play } from '../lib/sound';

export default function Scramble() {
  const { progress, update } = useApp();
  const order = useMemo(() => shuffle(WORDS.map((_, i) => i)), []);
  const [pos, setPos] = useState(0);
  const idx = order[pos % order.length];
  const word = WORDS[idx];
  const pool = useMemo(() => scrambleWord(word.word), [word]);
  const [chosen, setChosen] = useState([]); // מזהי אותיות לפי הסדר שנבחרו
  const [showHint, setShowHint] = useState(false);
  const [state, setState] = useState('play'); // play | wrong | right

  const text = chosen.map((id) => pool.find((l) => l.id === id).ch).join('');

  const letterOf = (id) => pool.find((l) => l.id === id).ch;

  // בודק אחרי כל שינוי: אם כל המשבצות מלאות – נכון או לא
  const settle = (next) => {
    setChosen(next);
    if (next.length < word.word.length) {
      setState('play');
      return;
    }
    if (next.map(letterOf).join('') === word.word) {
      setState('right');
      play('correct');
      if (!progress.scramble.includes(idx)) update((p) => ({ ...p, scramble: [...p.scramble, idx] }));
    } else {
      setState('wrong');
      play('wrong');
    }
  };

  const tap = (id) => {
    if (state === 'right' || chosen.includes(id)) return;
    if (chosen.length + 1 < word.word.length) play('tap');
    settle([...chosen, id]);
  };
  const back = () => {
    if (state === 'right') return;
    setChosen(chosen.slice(0, -1));
    setState('play');
  };
  const clear = () => {
    if (state === 'right') return;
    setChosen([]);
    setState('play');
  };
  // "גלו אות": מסדרים נכון את האותיות הראשונות ועוד אות אחת
  const reveal = () => {
    if (state === 'right') return;
    let ok = 0;
    while (ok < chosen.length && pool.find((l) => l.id === chosen[ok]).ch === word.word[ok]) ok++;
    const keep = chosen.slice(0, ok);
    const used = new Set(keep);
    const ch = word.word[ok];
    const found = pool.find((l) => l.ch === ch && !used.has(l.id));
    if (found && ok < word.word.length) {
      setShowHint(true);
      settle([...keep, found.id]);
    }
  };
  const next = () => {
    setPos(pos + 1);
    setChosen([]);
    setShowHint(false);
    setState('play');
  };

  return (
    <Layout title="מילה מבולבלת" back="#/games">
      <div className="max-w-xl mx-auto">
        <div className="text-center text-muted font-bold mb-3">מילה {(pos % order.length) + 1} מתוך {order.length} · נפתרו: {progress.scramble.length}</div>
        <div className="card p-5 text-center">
          <p className="mt-0 text-lg">סדרו את האותיות למילה שקשורה לחנוכה</p>

          <div className={`flex justify-center gap-2 min-h-16 mb-4 ${state === 'wrong' ? 'shake' : ''}`} aria-live="polite" aria-label={`המילה שהרכבתם: ${text}`}>
            {word.word.split('').map((_, i) => {
              const id = chosen[i];
              const has = id != null;
              return (
                <div
                  key={i}
                  className={`w-12 h-14 sm:w-14 sm:h-16 grid place-items-center rounded-xl border-2 text-3xl font-extrabold ${state === 'right' ? 'bg-good-soft border-good text-good' : state === 'wrong' && has ? 'bg-bad-soft border-bad text-bad' : 'border-dashed border-line'}`}
                >
                  {has ? pool.find((l) => l.id === id).ch : ''}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {pool.map((l) => (
              <button key={l.id} disabled={chosen.includes(l.id) || state === 'right'} onClick={() => tap(l.id)} className="btn w-14 h-14 sm:w-16 sm:h-16 px-0! text-3xl">
                {l.ch}
              </button>
            ))}
          </div>

          {state === 'wrong' && <p className="font-bold text-bad mt-0" role="status">לא בדיוק. מוחקים ומנסים שוב.</p>}
          {state === 'right' && <p className="font-extrabold text-good text-xl mt-0 pop" role="status">נכון! 🎉</p>}
          {showHint && <p className="mt-0 mb-3 rounded-xl bg-soft p-2">💡 רמז: {word.hint}</p>}

          <div className="flex flex-wrap justify-center gap-2">
            {state !== 'right' ? (
              <>
                <button className="btn btn-sm" onClick={back} disabled={!chosen.length}>⌫ מחיקה</button>
                <button className="btn btn-sm" onClick={clear} disabled={!chosen.length}>נקו הכול</button>
                <button className="btn btn-sm" onClick={() => setShowHint(true)}>💡 רמז</button>
                <button className="btn btn-sm" onClick={reveal}>גלו אות</button>
                <button className="btn btn-sm" onClick={next}>דלגו</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={next}>המילה הבאה ←</button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
