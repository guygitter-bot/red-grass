import { useEffect, useRef, useState } from 'react';
import { loadYouTubeApi } from '../lib/youtube';
import Icon from './Icon';

// נגן יוטיוב קטן (IFrame API) מעל הסט: נגן/השהה, עוצמת שיר ועוצמת תופים בנפרד, מתקפל.
// נשאר פעיל כל הזמן שהשיר טעון, גם כשעוברים בין מסכים (אז הוא מוסתר)
export default function SongPlayer({ videoId, hidden, songVol, drumVol, onSongVol, onDrumVol, onTitle, onClose, apiRef }) {
  const holder = useRef(null);
  const player = useRef(null);
  const volRef = useRef(songVol);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState('');
  // בטלפון לרוחב אין מקום לווידאו – מתחילים מקופל
  const [open, setOpen] = useState(() => !window.matchMedia?.('(max-height: 520px) and (orientation: landscape)').matches);
  const [failed, setFailed] = useState('');
  volRef.current = songVol;

  // יצירת הנגן פעם אחת ושינוי שיר בלי ליצור מחדש
  useEffect(() => {
    let dead = false;
    setFailed('');
    if (player.current) {
      try {
        player.current.cueVideoById(videoId);
        setTitle('');
      } catch {
        // הנגן עוד לא מוכן – ייטען בהתחלה
      }
      return;
    }
    loadYouTubeApi()
      .then((YT) => {
        if (dead || !holder.current) return;
        const target = document.createElement('div');
        holder.current.appendChild(target);
        player.current = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              setReady(true);
              // גישה לזמן ולקצב הנגינה, למצב הלימוד (הסנכרון של ההדגשות עם השיר)
              if (apiRef) {
                apiRef.current = {
                  getTime: () => e.target.getCurrentTime(),
                  isPlaying: () => e.target.getPlayerState() === 1,
                  getRate: () => e.target.getPlaybackRate(),
                  setRate: (r) => e.target.setPlaybackRate(r),
                };
              }
              e.target.setVolume(Math.round(volRef.current * 100));
              const t = e.target.getVideoData?.().title;
              if (t) {
                setTitle(t);
                onTitle?.(t);
              }
            },
            onStateChange: (e) => {
              setPlaying(e.data === 1);
              const t = e.target.getVideoData?.().title;
              if (t) {
                setTitle(t);
                onTitle?.(t);
              }
            },
            onError: () => setFailed('הסרטון הזה לא מאפשר ניגון בתוך אתר אחר, או שהקישור לא תקין. נסו שיר אחר.'),
          },
        });
      })
      .catch(() => setFailed('לא הצלחנו לטעון את נגן יוטיוב. בדקו חיבור לאינטרנט.'));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ניקוי הנגן כשהשיר מוסר
  useEffect(() => {
    return () => {
      try {
        player.current?.destroy();
      } catch {
        // כבר נהרס
      }
      player.current = null;
      if (apiRef) apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) player.current?.setVolume(Math.round(songVol * 100));
  }, [songVol, ready]);

  const toggle = () => {
    if (!ready) return;
    if (playing) player.current.pauseVideo();
    else player.current.playVideo();
  };

  return (
    <section className={`${hidden ? 'hidden' : ''} shrink-0 bg-card border-b border-line`} aria-label="נגן שיר">
      <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
        <button type="button" className="btn btn-primary !min-h-10 !px-3" onClick={toggle} disabled={!ready} aria-label={playing ? 'השהיה' : 'נגן'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <div className="min-w-0 flex-1 basis-24 text-sm font-semibold truncate" title={title}>{title || 'טוען שיר…'}</div>
        <label className="flex items-center gap-1 text-xs text-muted">
          <Icon name="note" size={18} />
          <input type="range" min="0" max="100" value={Math.round(songVol * 100)} onChange={(e) => onSongVol(e.target.value / 100)} className="w-20 sm:w-28" aria-label="עוצמת השיר" />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          <Icon name="drum" size={18} />
          <input type="range" min="0" max="100" value={Math.round(drumVol * 100)} onChange={(e) => onDrumVol(e.target.value / 100)} className="w-20 sm:w-28" aria-label="עוצמת התופים" />
        </label>
        <button type="button" className="btn !min-h-10 !px-3 text-sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'הסתר וידאו' : 'הצג וידאו'}</button>
        <button type="button" className="btn !min-h-10 !px-3 text-sm" onClick={onClose} aria-label="הסרת השיר"><Icon name="close" size={16} /></button>
      </div>
      {failed && <p className="px-3 pb-2 text-sm text-bad">{failed}</p>}
      <div className={open ? 'px-3 pb-2 flex justify-center' : 'h-0 overflow-hidden'}>
        <div ref={holder} className="aspect-video w-full max-w-[220px] short:max-w-[160px] lg:max-w-[320px] rounded-lg overflow-hidden bg-black [&_iframe]:w-full [&_iframe]:h-full" />
      </div>
    </section>
  );
}
