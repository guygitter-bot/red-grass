import { useEffect, useState } from 'react';
import KitStage from '../components/KitStage';
import { setMetronomeBpm, startMetronome, stopMetronome } from '../lib/sounds';

// מסך הנגינה: סרגל קטן למעלה (שם הסט, עוצמה, מטרונום) והסט עצמו על כל השאר
export default function PlayScreen({ kit, drumVol, onDrumVol, onPickKit }) {
  const [metro, setMetro] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [tipOff, setTipOff] = useState(false);

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
          <span className="truncate">{kit.name}</span> <span aria-hidden>▾</span>
        </button>
        <label className="flex items-center gap-1 text-sm text-muted ms-auto shrink-0">
          🔊
          <input type="range" min="0" max="100" value={Math.round(drumVol * 100)} onChange={(e) => onDrumVol(e.target.value / 100)} className="w-16 sm:w-32" aria-label="עוצמת התופים" />
        </label>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" className={`chip !min-h-10 ${metro ? 'on' : ''}`} onClick={() => setMetro(!metro)} aria-pressed={metro} aria-label="מטרונום">⏱<span className="hidden sm:inline"> מטרונום</span></button>
          {metro && (
            <span className="flex items-center gap-1" dir="ltr">
              <button type="button" className="btn !min-h-10 !px-3" aria-label="האט" onClick={() => setBpm(Math.max(40, bpm - 5))}>−</button>
              <span className="w-9 text-center font-bold tabular-nums">{bpm}</span>
              <button type="button" className="btn !min-h-10 !px-3" aria-label="האץ" onClick={() => setBpm(Math.min(220, bpm + 5))}>+</button>
            </span>
          )}
        </div>
      </div>
      {!tipOff && (
        <div className="rotate-tip shrink-0 items-center gap-2 px-3 py-1.5 bg-soft text-sm">
          <span aria-hidden>📱↔️</span>
          <span className="flex-1">סובבו את הטלפון לרוחב – הסט יהיה גדול יותר.</span>
          <button type="button" className="font-bold px-2" onClick={() => setTipOff(true)} aria-label="סגירה">✕</button>
        </div>
      )}
      <KitStage kit={kit} keys />
    </div>
  );
}
