import { useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Tile from '../components/Tile';
import Hanukkiah from '../components/Hanukkiah';
import { useApp } from '../context';
import { hanukkahStatus, tonightLine, NIGHT_NAMES } from '../lib/dates';
import { FACTS } from '../data/facts';
import { BADGES, earnedBadges } from '../lib/badges';

export default function Home() {
  const { progress, stars } = useApp();
  const status = useMemo(() => hanukkahStatus(new Date()), []);
  const [preview, setPreview] = useState(null); // תצוגה של לילה אחר (לא קשורה לתאריך)
  const night = preview != null ? preview : status.state === 'during' ? status.night : 0;
  // לפני ההדלקה (ובלילות שאחרי החג) מציגים חנוכייה מלאה בנרות כבויים
  const candles = Array.from({ length: 8 }, (_, i) => (night === 0 ? 'placed' : i < night ? 'lit' : 'none'));
  const dayNo = Math.floor(Date.now() / 86400000);
  const fact = FACTS[dayNo % FACTS.length];
  const earned = earnedBadges(progress).length;

  return (
    <Layout title="חנוכה לילדים">
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="night-panel lg:col-span-3 px-4 pt-5 pb-4 text-center flex flex-col items-center justify-center">
          <p className="m-0 text-xl lg:text-3xl font-extrabold text-gold">{preview != null ? (preview === 0 ? 'חנוכייה לפני ההדלקה' : `כך נראית החנוכייה בלילה ה${NIGHT_NAMES[preview - 1]}`) : tonightLine(status)}</p>
          <div className="w-full max-w-xl mt-2">
            <Hanukkiah candles={candles} shamash={night > 0 ? 'lit' : 'placed'} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button className="btn btn-sm" onClick={() => setPreview(preview == null ? 1 : preview >= 8 ? null : preview + 1)}>
              👀 {preview == null ? 'איך זה נראה בלילות אחרים?' : preview >= 8 ? 'חזרה להערב' : 'הלילה הבא'}
            </button>
          </div>
        </section>

        <section className="lg:col-span-2 flex flex-col gap-4">
          <div className="card p-4 flex items-center gap-4">
            <span className="text-5xl" aria-hidden="true">⭐</span>
            <div className="flex-1">
              <div className="text-3xl font-extrabold leading-tight">{stars}</div>
              <div className="text-muted">כוכבים שאספתם</div>
            </div>
            <a href="#/badges" className="btn btn-sm no-underline">🏆 {earned}/{BADGES.length}</a>
          </div>
          <div className="card p-4 bg-soft!">
            <div className="font-extrabold text-accent mb-1">💡 הידעת? העובדה של היום</div>
            <p className="m-0">{fact}</p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile href="#/story" icon="📖" title="סיפור החנוכה" sub={`${progress.story.length}/7 פרקים`} />
        <Tile href="#/customs" icon="🕎" title="מנהגי החג" sub="הדלקה, ברכות, סביבון" />
        <Tile href="#/quiz" icon="❓" title="חידון" sub="3 רמות" />
        <Tile href="#/games" icon="🎮" title="משחקים" sub="5 משחקים" />
        <Tile href="#/extras" icon="✨" title="תוספות" sub="חידות, מתכון, כרטיס" />
        <Tile href="#/badges" icon="🏆" title="תגים" sub={`${earned} מתוך ${BADGES.length}`} />
      </div>
    </Layout>
  );
}
