import Layout from '../components/Layout';
import { useApp } from '../context';
import { BADGES, earnedBadges } from '../lib/badges';
import { emptyProgress, saveProgress } from '../lib/progress';

export default function Badges() {
  const { progress, stars, update } = useApp();
  const earned = earnedBadges(progress);

  const reset = () => {
    if (window.confirm('למחוק את כל הכוכבים והתגים ולהתחיל מחדש?')) {
      update(() => emptyProgress());
      saveProgress(emptyProgress());
    }
  };

  return (
    <Layout title="תגים וכוכבים" back="#/">
      <div className="card p-5 flex items-center gap-4 mb-5">
        <span className="text-5xl" aria-hidden="true">⭐</span>
        <div>
          <div className="text-3xl font-extrabold">{stars} כוכבים</div>
          <div className="text-muted">{earned.length} תגים מתוך {BADGES.length}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BADGES.map((b) => {
          const got = earned.includes(b.id);
          return (
            <div key={b.id} className={`card p-4 flex items-center gap-4 ${got ? 'border-gold! bg-soft!' : 'opacity-70'}`}>
              <span className={`text-4xl ${got ? '' : 'grayscale'}`} aria-hidden="true">{got ? b.icon : '🔒'}</span>
              <div>
                <div className="font-extrabold">{b.name}</div>
                <div className="text-sm text-muted">{b.desc}</div>
                <div className="sr-only">{got ? 'הושג' : 'עוד לא הושג'}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <button className="btn btn-sm" onClick={reset}>איפוס ההתקדמות</button>
      </div>
    </Layout>
  );
}
