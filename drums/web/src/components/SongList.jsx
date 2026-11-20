import { grooveFor } from '../data/grooves';
import { youtubeUrl } from '../data/songs';
import Icon from './Icon';

// רשימת שירים של סט – כמו סט-ליסט מודפס שמודבק לרצפת הבמה: לחיצה על שיר טוענת אותו לנגן,
// "ללמוד" פותח את מצב הלימוד, וקישור קטן פותח ביוטיוב. השמות באנגלית בתוך bdi (שלא יתהפכו בעברית).
export default function SongList({ songs, current, onPlay, onLearn, heading, className = '' }) {
  return (
    <div className={`setlist ${className}`}>
      {heading && <p className="text-xs font-bold muted mb-1.5">{heading}</p>}
      <ol className="flex flex-col divide-y divide-[#d9d3c6]">
        {songs.map((s, i) => (
          <li key={s.youtubeId} className="row flex items-center gap-2 py-1" data-current={current === s.youtubeId}>
            <span className="setlist-title w-6 shrink-0 text-center opacity-60" aria-hidden>{i + 1}</span>
            <button type="button" className="flex-1 min-w-0 min-h-11 text-start" onClick={() => onPlay(s)} aria-label={`לנגן עם ${s.title}`}>
              <bdi dir="ltr" className="setlist-title block truncate">{s.title}</bdi>
              <span className="block text-xs muted truncate"><bdi dir="ltr">{s.artist}</bdi>{s.note ? `, ${s.note}` : ''}</span>
            </button>
            {onLearn && grooveFor(s.youtubeId) && (
              <button type="button" className="tag-btn shrink-0" onClick={() => onLearn(s)} aria-label={`ללמוד את ${s.title}`}><Icon name="cap" size={16} />ללמוד</button>
            )}
            <a href={youtubeUrl(s.youtubeId)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs underline px-1 min-h-11 flex items-center" aria-label={`פתיחת ${s.title} ביוטיוב`}>יוטיוב</a>
          </li>
        ))}
      </ol>
    </div>
  );
}
