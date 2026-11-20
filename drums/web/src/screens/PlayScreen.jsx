import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import KitStage from '../components/KitStage';
import LessonPanel from '../components/LessonPanel';
import SongList from '../components/SongList';
import { grooveFor } from '../data/grooves';
import { songById } from '../data/songs';
import { setMetronomeBpm, startMetronome, stopMetronome } from '../lib/sounds';

// מסך הנגינה: סרגל קטן למעלה (שם הסט, עוצמה, מטרונום) והסט עצמו על כל השאר
export default function PlayScreen({ kit, drumVol, onDrumVol, onPickKit, songs = [], currentSong, onLoadSong, lessonId, onLesson, songApi }) {
  const [metro, setMetro] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [tipOff, setTipOff] = useState(false);
  const [songsOpen, setSongsOpen] = useState(false);
  // מצב לימוד: האלמנט של הסט (להדגשות) והפונקציה שמקבלת מכות של המשתמש
  const boxRef = useRef(null);
  const hitRef = useRef(null);
  const lessonSong = lessonId && grooveFor(lessonId) ? songById(lessonId) : null;
  // שיר שטעון בנגן ויש לו ביט – כפתור מהיר להתחיל ללמוד אותו
  const loadedLearnable = currentSong && grooveFor(currentSong) && songById(currentSong);

  useEffect(() => {
    if (metro) startMetronome(bpm);
    else stopMetronome();
    return () => {
      stopMetronome();
    };
    // BPM משתנה בלי להפעיל מחדש (למטה)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metro]);

  useEffect(() => {
    setMetronomeBpm(bpm);
  }, [bpm]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-card border-b border-line">
        <button type="button" className="btn !min-h-10 !px-3 text-sm min-w-0 shrink" onClick={onPickKit} aria-label="החלפת סט">
          <span className="truncate font-display text-2xl leading-none pt-0.5">{kit.name}</span> <Icon name="chevronDown" size={16} />
        </button>
        <label className="flex items-center gap-1 text-sm text-muted ms-auto shrink-0">
          <Icon name="volume" size={20} />
          <input type="range" min="0" max="100" value={Math.round(drumVol * 100)} onChange={(e) => onDrumVol(e.target.value / 100)} className="w-16 sm:w-32" aria-label="עוצמת התופים" />
        </label>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" className={`chip !min-h-10 ${metro ? 'on' : ''}`} onClick={() => setMetro(!metro)} aria-pressed={metro} aria-label="מטרונום"><Icon name="metronome" size={18} /><span className="hidden sm:inline">מטרונום</span></button>
          {metro && (
            <span className="flex items-center gap-1" dir="ltr">
              <button type="button" className="btn !min-h-10 !px-3" aria-label="האט" onClick={() => setBpm(Math.max(40, bpm - 5))}>−</button>
              <span className="w-9 text-center font-bold tabular-nums">{bpm}</span>
              <button type="button" className="btn !min-h-10 !px-3" aria-label="האץ" onClick={() => setBpm(Math.min(220, bpm + 5))}>+</button>
            </span>
          )}
        </div>
        {loadedLearnable && !lessonSong && (
          <button type="button" className="chip !min-h-10" onClick={() => onLesson(currentSong)} aria-label="ללמוד את השיר"><Icon name="cap" size={18} /><span className="hidden sm:inline">ללמוד את השיר</span></button>
        )}
        {songs.length > 0 && (
          <button type="button" className={`chip !min-h-10 ${songsOpen ? 'on' : ''}`} onClick={() => setSongsOpen(!songsOpen)} aria-pressed={songsOpen} aria-label="שירים של הסט"><Icon name="note" size={18} /><span className="hidden sm:inline">שירים</span></button>
        )}
      </div>
      {songsOpen && songs.length > 0 && (
        <div className="shrink-0 max-h-[45%] overflow-y-auto px-3 py-2 bg-card border-b border-line">
          <p className="text-sm font-bold mb-1">שירים של <bdi dir="ltr">{songs[0].artist}</bdi></p>
          <SongList songs={songs} current={currentSong} onPlay={(s) => { onLoadSong(s.youtubeId); setSongsOpen(false); }} onLearn={(s) => { onLesson(s.youtubeId); setSongsOpen(false); }} />
        </div>
      )}
      {!tipOff && !lessonSong && (
        <div className="rotate-tip shrink-0 items-center gap-2 px-3 py-1.5 bg-soft text-sm">
          <Icon name="rotate" size={20} />
          <span className="flex-1">סובבו את הטלפון לרוחב – הסט יהיה גדול יותר.</span>
          <button type="button" className="font-bold px-2" onClick={() => setTipOff(true)} aria-label="סגירה"><Icon name="close" size={16} /></button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row short:flex-row">
        {lessonSong && (
          <div className="shrink-0 lg:w-[390px] short:w-[340px] short:max-w-[45%] lg:overflow-y-auto short:overflow-y-auto lg:border-e short:border-e lg:border-line short:border-line">
            <LessonPanel song={lessonSong} kit={kit} boxRef={boxRef} hitRef={hitRef} songApi={songApi} songLoaded={currentSong === lessonSong.youtubeId} onLoadSong={onLoadSong} onClose={() => onLesson(null)} />
          </div>
        )}
        <KitStage kit={kit} keys boxRef={boxRef} onUserHit={(id) => hitRef.current?.(id)} />
      </div>
    </div>
  );
}
