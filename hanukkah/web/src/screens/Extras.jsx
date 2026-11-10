import Layout from '../components/Layout';
import Tile from '../components/Tile';
import { useApp } from '../context';
import { FACTS } from '../data/facts';
import { RIDDLES } from '../data/riddles';

export default function Extras() {
  const { progress: p } = useApp();
  return (
    <Layout title="תוספות" back="#/">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile href="#/extras/facts" icon="💡" title="הידעת?" sub={`${p.facts.length}/${FACTS.length} נקראו`} />
        <Tile href="#/extras/riddles" icon="🧩" title="חידות" sub={`${p.riddles.length}/${RIDDLES.length} נפתרו`} />
        <Tile href="#/extras/songs" icon="🎵" title="שירים וברכות" sub="נוסחים מסורתיים" />
        <Tile href="#/extras/recipe" icon="🥔" title="מתכון ללביבות" sub="עם מבוגר" />
        <Tile href="#/extras/card" icon="💌" title="כרטיס ברכה" sub="יוצרים ושולחים" />
        <Tile href="#/badges" icon="🏆" title="תגים" sub="אבני דרך" />
      </div>
    </Layout>
  );
}
