import Layout from '../components/Layout';
import Tile from '../components/Tile';
import { useApp } from '../context';

export default function Games() {
  const { progress: p } = useApp();
  return (
    <Layout title="משחקים" back="#/">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile href="#/games/dreidel" icon="🌀" title="סביבון" sub={`ניצחונות: ${p.dreidel.wins}`} />
        <Tile href="#/games/memory" icon="🧠" title="זיכרון" sub="זוגות של סמלי החג" />
        <Tile href="#/games/candles" icon="🕯️" title="הדלקת החנוכייה" sub={`${p.candles.length} מתוך 8 לילות`} />
        <Tile href="#/games/catch" icon="🍩" title="תפוס את הסופגניות" sub={`שיא: ${p.catchBest}`} />
        <Tile href="#/games/scramble" icon="🔤" title="מילה מבולבלת" sub={`נפתרו: ${p.scramble.length}`} />
      </div>
    </Layout>
  );
}
