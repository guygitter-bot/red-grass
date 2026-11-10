import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';
import { LETTERS, newGame, applyLetter } from '../lib/dreidel';
import { play } from '../lib/sound';

const NAMES = { you: 'אתם', pc: 'המחשב' };
const EFFECT = {
  נ: () => 'לא קורה כלום',
  ג: (l) => `לוקחים את כל הקופה (+${l.gained})`,
  ה: (l) => `לוקחים חצי מהקופה (+${l.gained})`,
  פ: (l) => (l.put ? 'שמים מטבע בקופה' : 'אין מטבע לשים'),
};

function DreidelSvg({ letter }) {
  return (
    <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
      <rect x="56" y="4" width="8" height="30" rx="3" fill="#c98a1a" />
      <path d="M22 40 H98 V92 L60 150 L22 92 Z" fill="#ffc23e" stroke="#c98a1a" strokeWidth="4" strokeLinejoin="round" />
      <text x="60" y="94" textAnchor="middle" fontSize="50" fontWeight="800" fill="#14224d" fontFamily="system-ui, Arial, sans-serif">{letter}</text>
    </svg>
  );
}

function Coins({ n }) {
  return (
    <div className="flex flex-wrap justify-center gap-0.5 min-h-8 text-xl" aria-hidden="true">
      {Array.from({ length: Math.min(n, 14) }, (_, i) => (
        <span key={i}>🪙</span>
      ))}
    </div>
  );
}

export default function Dreidel() {
  const { update } = useApp();
  const [game, setGame] = useState(newGame());
  const [spin, setSpin] = useState(null); // { letter } בזמן סיבוב
  const [shown, setShown] = useState('נ');
  const recorded = useRef(false);

  const startSpin = () => {
    play('spin');
    setSpin({ letter: LETTERS[Math.floor(Math.random() * 4)] });
  };

  // בזמן הסיבוב: אותיות מהבהבות, ובסוף מוחלת התוצאה
  useEffect(() => {
    if (!spin) return undefined;
    const flick = setInterval(() => {
      setShown(LETTERS[Math.floor(Math.random() * 4)]);
    }, 110);
    const done = setTimeout(() => {
      setShown(spin.letter);
      setGame((g) => applyLetter(g, spin.letter));
      setSpin(null);
      play(spin.letter === 'ג' || spin.letter === 'ה' ? 'correct' : 'tap');
    }, 1400);
    return () => {
      clearInterval(flick);
      clearTimeout(done);
    };
  }, [spin]);

  // תור המחשב
  useEffect(() => {
    if (game.over || game.turn !== 'pc' || spin) return undefined;
    const t = setTimeout(() => {
      startSpin();
    }, 1200);
    return () => {
      clearTimeout(t);
    };
  }, [game, spin]);

  // סוף משחק: שומרים ניצחון
  useEffect(() => {
    if (!game.over || recorded.current) return;
    recorded.current = true;
    update((p) => ({ ...p, dreidel: { played: p.dreidel.played + 1, wins: p.dreidel.wins + (game.winner === 'you' ? 1 : 0) } }));
    if (game.winner === 'you') play('win');
  }, [game.over]);

  const again = () => {
    recorded.current = false;
    setGame(newGame());
    setShown('נ');
  };

  const last = game.last;
  return (
    <Layout title="סביבון" back="#/games">
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <section className="night-panel p-4 text-center">
          <div className="flex justify-around items-start gap-2">
            <div className="flex-1">
              <div className="font-extrabold">אתם</div>
              <div className="text-3xl font-extrabold text-gold">{game.coins.you}</div>
              <Coins n={game.coins.you} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold">הקופה</div>
              <div className="text-3xl font-extrabold text-gold">{game.pot}</div>
              <Coins n={game.pot} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold">המחשב</div>
              <div className="text-3xl font-extrabold text-gold">{game.coins.pc}</div>
              <Coins n={game.coins.pc} />
            </div>
          </div>
          <div className="dreidel-wrap flex justify-center my-3">
            <div className={spin ? 'dreidel-spin' : ''}>
              <DreidelSvg letter={shown} />
            </div>
          </div>
          <div className="text-sm opacity-80">סיבוב {game.round} מתוך {game.maxRounds}</div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="card p-4 text-center" role="status" aria-live="polite">
            {game.over ? (
              <>
                <div className="text-3xl pop">{game.winner === 'you' ? '🏆' : game.winner === 'pc' ? '🤖' : '🤝'}</div>
                <div className="text-xl font-extrabold">{game.winner === 'you' ? 'ניצחתם!' : game.winner === 'pc' ? 'המחשב ניצח הפעם' : 'תיקו!'}</div>
                <div className="text-muted mb-3">{game.coins.you} מטבעות אצלכם, {game.coins.pc} אצל המחשב</div>
                <button className="btn btn-primary" onClick={again}>משחק חדש</button>
              </>
            ) : (
              <>
                <div className="text-lg font-extrabold mb-1">{game.turn === 'you' ? 'התור שלכם' : 'התור של המחשב'}</div>
                <div className="min-h-12 text-muted">
                  {last && !spin
                    ? `${last.ante ? 'כולם שמו מטבע. ' : ''}${NAMES[last.who]}: יצא ${last.letter}, ${EFFECT[last.letter](last)}`
                    : spin
                      ? 'הסביבון מסתובב...'
                      : 'שמים מטבע, וסובבים את הסביבון!'}
                </div>
                <button className="btn btn-primary w-full text-xl min-h-14 mt-2" disabled={game.turn !== 'you' || !!spin} onClick={startSpin}>
                  🌀 סובבו את הסביבון
                </button>
              </>
            )}
          </div>

          <div className="card p-4">
            <div className="font-extrabold mb-2">הכללים</div>
            <ul className="m-0 ps-5">
              <li><b>נ</b> – לא קורה כלום.</li>
              <li><b>ג</b> – לוקחים את כל הקופה.</li>
              <li><b>ה</b> – לוקחים חצי מהקופה (מעגלים כלפי מעלה).</li>
              <li><b>פ</b> – שמים מטבע בקופה.</li>
              <li>כשהקופה ריקה, כל אחד שם מטבע אחד.</li>
              <li>המשחק נגמר אחרי 10 סיבובים, או כשלמישהו נגמרים המטבעות.</li>
            </ul>
          </div>
        </section>
      </div>
    </Layout>
  );
}
