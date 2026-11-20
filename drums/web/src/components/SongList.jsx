import { grooveFor } from '../data/grooves';
import { youtubeUrl } from '../data/songs';
import Icon from './Icon';

// רשימת שירים של סט: לחיצה על שיר טוענת אותו לנגן, וקישור קטן פותח אותו ביוטיוב.
// שמות השירים באנגלית – בתוך bdi עם dir=ltr כדי שלא יתהפכו בתוך עברית.
export default function SongList({ songs, current, onPlay, onLearn, className = '' }) {
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {songs.map((s) => (
        <li key={s.youtubeId} className={`flex items-center gap-2 rounded-lg border bg-card px-2 py-1 ${current === s.youtubeId ? 'border-accent' : 'border-line'}`}>
          <button type="button" className="flex-1 min-w-0 min-h-10 text-start" onClick={() => onPlay(s)}>
            <span className="block text-sm font-semibold truncate"><Icon name="play" size={11} className="inline me-1.5 text-accent" /><bdi dir="ltr">{s.title}</bdi></span>
            <span className="block text-xs text-muted truncate"><bdi dir="ltr">{s.artist}</bdi>{s.note ? `, ${s.note}` : ''}</span>
          </button>
          {onLearn && grooveFor(s.youtubeId) && (
            <button type="button" className="shrink-0 btn !min-h-9 !px-2 text-xs" onClick={() => onLearn(s)} aria-label={`ללמוד את ${s.title}`}><Icon name="cap" size={16} />ללמוד</button>
          )}
          <a href={youtubeUrl(s.youtubeId)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs underline text-accent px-1 min-h-10 flex items-center">פתיחה ביוטיוב</a>
        </li>
      ))}
    </ul>
  );
}
