import { useState } from 'react';
import Layout from '../components/Layout';
import Hanukkiah from '../components/Hanukkiah';
import { useApp } from '../context';
import { NIGHT_NAMES } from '../lib/dates';
import { newCandleGame, placeCandle, placeShamash, lightTap, candleView, nextToLight } from '../lib/candles';
import { play } from '../lib/sound';

const randomNight = (not) => {
  let n;
  do {
    n = 1 + Math.floor(Math.random() * 8);
  } while (n === not);
  return n;
};

export default function Candles() {
  const { progress, update } = useApp();
  const [game, setGame] = useState(() => newCandleGame(randomNight(0)));
  const [fb, setFb] = useState(null); // { ok, msg }

  const apply = (r) => {
    const wasDone = game.phase === 'done';
    setGame(r.state);
    if (r.feedback.msg) {
      setFb(r.feedback);
      play(r.feedback.ok ? 'tap' : 'wrong');
    }
    if (!wasDone && r.state.phase === 'done') {
      play('win');
      if (r.state.mistakes === 0) {
        update((p) => ({ ...p, candles: [...p.candles, r.state.night] }));
      }
    }
  };

  const onCandle = (k) => apply(game.phase === 'place' ? placeCandle(game, k) : lightTap(game, k));
  const onShamash = () => apply(game.phase === 'place' ? placeShamash(game) : lightTap(game, 'shamash'));
  const view = candleView(game);

  const next = () => {
    setGame(newCandleGame(randomNight(game.night)));
    setFb(null);
  };
  const hint = () => {
    if (game.phase === 'place') {
      setFb({ ok: true, msg: `מניחים ${game.night === 1 ? 'נר אחד' : game.night + ' נרות'} מהצד הימני, ועוד שמש באמצע.` });
    } else if (game.phase === 'light') {
      const n = nextToLight(game);
      setFb({ ok: true, msg: n === 'shamash' ? 'מדליקים את השמש, זה הנר שבאמצע.' : `עכשיו מדליקים את הנר ה-${n} מימין.` });
    }
  };

  const instr = {
    place: `שלב 1: הניחו ${game.night === 1 ? 'נר אחד' : game.night + ' נרות'} בחנוכייה, מהצד הימני, ואת השמש באמצע. לחצו על המקום הריק.`,
    light: 'שלב 2: הדליקו. קודם את השמש, אחר כך את הנר החדש (השמאלי) וממשיכים ימינה.',
    done: 'החנוכייה דולקת!',
  }[game.phase];

  return (
    <Layout title="הדלקת החנוכייה" back="#/games">
      <div className="grid gap-5 lg:grid-cols-5 items-start">
        <section className="night-panel lg:col-span-3 p-2 sm:p-4">
          <div className="text-center text-xl font-extrabold text-gold mb-1">הלילה ה{NIGHT_NAMES[game.night - 1]}: {game.night === 1 ? 'נר אחד' : `${game.night} נרות`}</div>
          <Hanukkiah candles={view.candles} shamash={view.shamash} interactive={game.phase !== 'done'} onCandle={onCandle} onShamash={onShamash} />
          <div className="flex justify-between text-sm opacity-80 px-2" aria-hidden="true">
            <span>ימין</span>
            <span>שמאל</span>
          </div>
        </section>

        <section className="lg:col-span-2 flex flex-col gap-3">
          <div className="card p-4">
            <p className="m-0 font-bold">{instr}</p>
          </div>
          <div role="status" aria-live="polite" className={`card p-4 min-h-16 ${fb ? (fb.ok ? 'border-good!' : 'border-bad! bg-bad-soft!') : ''}`}>
            {fb ? <span className={fb.ok ? 'text-good font-bold' : 'text-bad font-bold'}>{fb.msg}</span> : <span className="text-muted">כאן יופיעו הודעות עזרה.</span>}
          </div>
          <div className="flex gap-3">
            <button className="btn flex-1" onClick={hint} disabled={game.phase === 'done'}>💡 רמז</button>
            <button className="btn btn-primary flex-1" onClick={next}>{game.phase === 'done' ? 'לילה חדש' : 'דלגו ללילה אחר'}</button>
          </div>
          {game.phase === 'done' && (
            <div className="card p-4 text-center pop">
              {game.mistakes === 0 ? '🌟 בלי טעויות! קיבלתם כוכב על הלילה הזה.' : `סיימתם עם ${game.mistakes} טעויות. נסו שוב בלי טעויות כדי לקבל כוכב.`}
            </div>
          )}
          <div className="text-muted text-sm">לילות שהודלקו נכון עד עכשיו: {progress.candles.length} מתוך 8 {progress.candles.length ? `(${progress.candles.join(', ')})` : ''}</div>
        </section>
      </div>
    </Layout>
  );
}
