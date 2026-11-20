import { KITS } from '../data/kits';
import { songsForKit } from '../data/songs';
import Icon from '../components/Icon';
import SongList from '../components/SongList';
import { finishOf } from '../lib/finish';
import { PIECES } from '../lib/kit';

// ספירה קצרה של החלקים לכרטיס: "3 טומים · 2 מצילות"
function summary(pieces) {
  const n = (f) => pieces.filter(f).length;
  const toms = n((id) => PIECES[id].type === 'tom' || PIECES[id].type === 'floor');
  const cym = n((id) => ['crash', 'ride', 'china', 'splash'].includes(PIECES[id].type));
  const parts = [`${toms} טומים`, `${cym} מצילות`];
  if (pieces.includes('kick2')) parts.unshift('בס כפול');
  if (pieces.includes('cowbell')) parts.push('פעמון');
  return parts.join(', ');
}

function KitCard({ kit, active, onPick, onPickSong, onLearnSong, children }) {
  const songs = songsForKit(kit.custom ? kit.baseId : kit.id);
  return (
    <article data-finish={finishOf(kit)} className={`kit-card rounded-3xl border-2 p-4 flex flex-col gap-2 ${active ? 'border-accent' : 'border-line'}`}>
      <div className="flex items-center gap-3">
        <span className="emblem" aria-hidden />
        <div className="min-w-0">
          <h3 className="font-display text-3xl leading-none">{kit.name}</h3>
          {kit.drummer && <p className="text-sm text-muted mt-0.5">{kit.drummer}</p>}
        </div>
      </div>
      {kit.desc && <p className="text-sm leading-relaxed">{kit.desc}</p>}
      <p className="text-xs text-muted">{summary(kit.pieces)}</p>
      {songs.length > 0 && (
        <details className="rounded-xl bg-soft px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold min-h-8 flex items-center gap-1.5"><Icon name="note" size={16} />שירים לנגן עם הסט ({songs.length})</summary>
          <SongList songs={songs} onPlay={(s) => onPickSong(kit.id, s.youtubeId)} onLearn={(s) => onLearnSong(kit.id, s.youtubeId)} className="mt-2" />
        </details>
      )}
      <div className="flex gap-2 flex-wrap mt-auto pt-1">
        <button type="button" className={`btn !min-h-10 text-sm ${active ? '' : 'btn-primary'}`} onClick={onPick}>
          {active && <Icon name="check" size={16} />}{active ? 'הסט הפעיל, לנגן' : 'לנגן על הסט'}
        </button>
        {children}
      </div>
    </article>
  );
}

// בחירת סט: הסטים שלי (אם יש) וסטים בהשראת מתופפים מפורסמים
export default function KitsScreen({ activeId, custom, onPick, onPickSong, onLearnSong, onEdit, onDelete, onBuild }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 flex flex-col gap-5">
        <header>
          <h1 className="font-display text-5xl leading-none">סטים</h1>
          <p className="text-muted text-sm">בחרו סט, או התחילו מסט מפורסם ושנו אותו בעצמכם.</p>
        </header>
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-3xl leading-none">הסטים שלי</h2>
            <button type="button" className="btn btn-primary !min-h-10 text-sm" onClick={() => onBuild(null)}>+ בניית סט חדש</button>
          </div>
          {custom.length === 0 ? (
            <p className="text-sm text-muted rounded-2xl border border-dashed border-line p-4">עוד לא בניתם סט. לחצו "בניית סט חדש" או "לערוך" ליד אחד הסטים המפורסמים.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {custom.map((k) => (
                <KitCard key={k.id} kit={k} active={k.id === activeId} onPick={() => onPick(k.id)} onPickSong={onPickSong} onLearnSong={onLearnSong}>
                  <button type="button" className="btn !min-h-10 text-sm" onClick={() => onBuild(k)}>עריכה</button>
                  <button type="button" className="btn !min-h-10 text-sm" onClick={() => onDelete(k)} aria-label={`מחיקת ${k.name}`}><Icon name="trash" size={18} /></button>
                </KitCard>
              ))}
            </div>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-3xl leading-none">סטים מפורסמים</h2>
          <p className="text-xs text-muted -mt-2">"בהשראת" – תיאור כללי של הסגנון והסט, לא העתק של ציוד אמיתי.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KITS.map((k) => (
              <KitCard key={k.id} kit={k} active={k.id === activeId} onPick={() => onPick(k.id)} onPickSong={onPickSong} onLearnSong={onLearnSong}>
                <button type="button" className="btn !min-h-10 text-sm" onClick={() => onBuild(k)}>התחל ממנו ולערוך</button>
              </KitCard>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
