import { useEffect, useState } from 'react';
import { KITS } from '../data/kits';
import { songsForKit } from '../data/songs';
import Icon from '../components/Icon';
import SongList from '../components/SongList';
import { FINISH_COLORS, finishOf } from '../lib/finish';
import { PIECES } from '../lib/kit';

// ספירה קצרה של החלקים לכרטיס: "3 טומים, 2 מצילות"
function summary(pieces) {
  const n = (f) => pieces.filter(f).length;
  const toms = n((id) => PIECES[id].type === 'tom' || PIECES[id].type === 'floor');
  const cym = n((id) => ['crash', 'ride', 'china', 'splash'].includes(PIECES[id].type));
  const parts = [`${toms} טומים`, `${cym} מצילות`];
  if (pieces.includes('kick2')) parts.unshift('בס כפול');
  if (pieces.includes('cowbell')) parts.push('פעמון');
  return parts;
}

// תמונות תלת־ממד של הסטים (נטען בנפרד, רק אם יש WebGL). בלי – נשאר הצבע של העטיפה
function useThumbs(kits) {
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    let cancel = () => {};
    let dead = false;
    const hasGL = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return !!gl;
      } catch {
        return false;
      }
    })();
    if (!hasGL) return undefined;
    import('../three/thumbs')
      .then(({ renderThumbs, cachedThumb }) => {
        if (dead) return;
        const ready = {};
        for (const k of kits) {
          const u = cachedThumb(k);
          if (u) ready[k.id] = u;
        }
        setThumbs(ready);
        cancel = renderThumbs(kits, (k, url) => {
          if (!dead) setThumbs((t) => ({ ...t, [k.id]: url }));
        });
      })
      .catch(() => {});
    return () => {
      dead = true;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kits.map((k) => k.id + k.pieces.length).join(',')]);
  return thumbs;
}

// כרטיס סט = אישור כניסה לבמה: פס בצבעי העטיפה עם חור לשרוך, תמונת הסט, שם, מתופף על טייפ, שירים וכפתורים
function KitCard({ kit, active, thumb, onPick, onPickSong, onLearnSong, children }) {
  const songs = songsForKit(kit.custom ? kit.baseId : kit.id);
  const finish = finishOf(kit);
  return (
    <article data-finish={finish} data-active={active} className="pass flex flex-col">
      <div className="pass-band px-4 pt-6 pb-2 flex items-end justify-between gap-2">
        <span className="font-display text-xl leading-none tracking-wide">גישה לבמה</span>
        <span className="text-[11px] font-bold opacity-90">{FINISH_COLORS[finish]?.name}</span>
      </div>
      <div className="thumb relative overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={`הסט ${kit.name}`} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="emblem" />
          </span>
        )}
        {active && <span className="tape absolute top-3 start-3 text-lg rotate-[-4deg]">על הבמה עכשיו</span>}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="poster text-[2.6rem]">{kit.name}</h3>
        {kit.drummer && <p><span className="gaffer text-xl">{kit.drummer}</span></p>}
        {kit.desc && <p className="text-sm leading-relaxed">{kit.desc}</p>}
        <p className="flex flex-wrap gap-1.5">
          {summary(kit.pieces).map((t) => (
            <span key={t} className="text-xs font-bold px-2 py-0.5 rounded-[3px] border border-line text-muted">{t}</span>
          ))}
        </p>
        {songs.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-bold min-h-11 flex items-center gap-1.5"><Icon name="note" size={16} />הסט-ליסט ({songs.length} שירים)</summary>
            <SongList songs={songs} onPlay={(s) => onPickSong(kit.id, s.youtubeId)} onLearn={(s) => onLearnSong(kit.id, s.youtubeId)} className="mt-4 mx-2 mb-2" />
          </details>
        )}
        <div className="flex gap-2 flex-wrap mt-auto pt-1">
          <button type="button" className={`btn !min-h-11 text-sm ${active ? '' : 'btn-primary'}`} onClick={onPick}>
            {active ? <><Icon name="check" size={16} />לנגן עליו</> : <><Icon name="drum" size={16} />לעלות לבמה</>}
          </button>
          {children}
        </div>
      </div>
    </article>
  );
}

// בחירת סט: הסטים שלי (אם יש) וסטים בהשראת מתופפים מפורסמים
export default function KitsScreen({ activeId, custom, onPick, onPickSong, onLearnSong, onDelete, onBuild }) {
  const thumbs = useThumbs([...custom, ...KITS]);
  return (
    <div className="floor flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-8 flex flex-col gap-7">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="poster text-7xl">הסטים</h1>
            <p className="text-muted text-sm mt-1">בחרו סט לעלות איתו לבמה, או התחילו מסט מפורסם ושנו אותו בעצמכם.</p>
          </div>
          <button type="button" className="btn btn-primary !min-h-11 text-sm" onClick={() => onBuild(null)}><Icon name="sliders" size={18} />בניית סט חדש</button>
        </header>
        <section className="flex flex-col gap-3">
          <h2 className="poster text-4xl">הסטים שלי</h2>
          {custom.length === 0 ? (
            <p className="case text-sm text-muted p-4">עוד לא בניתם סט. לחצו "בניית סט חדש", או "להתחיל ממנו" באחד הסטים המפורסמים.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {custom.map((k) => (
                <KitCard key={k.id} kit={k} active={k.id === activeId} thumb={thumbs[k.id]} onPick={() => onPick(k.id)} onPickSong={onPickSong} onLearnSong={onLearnSong}>
                  <button type="button" className="btn !min-h-11 text-sm" onClick={() => onBuild(k)}>עריכה</button>
                  <button type="button" className="btn !min-h-11 text-sm" onClick={() => onDelete(k)} aria-label={`מחיקת ${k.name}`}><Icon name="trash" size={18} /></button>
                </KitCard>
              ))}
            </div>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="poster text-4xl">סטים מפורסמים</h2>
          <p className="text-xs text-muted -mt-1">"בהשראת" – תיאור כללי של הסגנון והסט, לא העתק של ציוד אמיתי.</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {KITS.map((k) => (
              <KitCard key={k.id} kit={k} active={k.id === activeId} thumb={thumbs[k.id]} onPick={() => onPick(k.id)} onPickSong={onPickSong} onLearnSong={onLearnSong}>
                <button type="button" className="btn !min-h-11 text-sm" onClick={() => onBuild(k)}>להתחיל ממנו ולערוך</button>
              </KitCard>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
