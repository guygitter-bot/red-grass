import { useEffect, useRef, useState } from 'react';
import { getMedia } from '../lib/store';
import { frameSize, playFilm } from '../lib/film';
import { downloadBlob, shareBlob, fileName, videoExt } from '../lib/image';

// הסרט המלא: כל השוטים המוכנים ברצף, עם כותרת פתיחה ושקופית סיום. אפשר לצפות, ואפשר להקליט לקובץ אחד
export default function Film({ project }) {
  const canvas = useRef(null);
  const player = useRef(null);
  const [urls, setUrls] = useState([]);
  const [mode, setMode] = useState(''); // '' / 'play' / 'record'
  const [progress, setProgress] = useState(0);
  const [film, setFilm] = useState(null); // הקובץ שהוקלט
  const [error, setError] = useState('');
  const size = frameSize(project.brief.aspect);
  const readyIds = project.shots.filter((s) => s.hasClip).map((s) => s.id).join(',');

  // כתובות לשוטים המוכנים, לפי הסדר בסרט
  useEffect(() => {
    let on = true;
    let made = [];
    Promise.all(readyIds.split(',').filter(Boolean).map((id) => getMedia(`${id}:clip`))).then((blobs) => {
      if (!on) return;
      made = blobs.filter(Boolean).map((b) => URL.createObjectURL(b));
      setUrls(made);
      setFilm(null);
    }).catch(() => {});
    return () => {
      on = false;
      player.current?.stop();
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [readyIds]);

  const start = async (record) => {
    setError('');
    setProgress(0);
    setMode(record ? 'record' : 'play');
    try {
      const titles = { name: project.name, tagline: project.tagline, contact: project.contact };
      player.current = playFilm(canvas.current, urls, titles, { record, onProgress: setProgress });
      const blob = await player.current.done;
      if (blob) setFilm(blob);
    } catch (e) {
      setError(e.message || 'משהו השתבש. נסו שוב.');
    } finally {
      player.current = null;
      setMode('');
    }
  };

  const name = () => `${fileName(project.name, ' - הסרט המלא')}.${videoExt(film?.type)}`;
  const vertical = project.brief.aspect === '9:16';

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg font-bold">הסרט המלא</h2>
      <p className="text-sm text-muted">
        {urls.length} שוטים ברצף, עם שם הפרויקט בפתיחה ופרטי הקשר בסיום.
      </p>

      <div className="mt-3 overflow-hidden rounded-xl bg-black">
        <canvas ref={canvas} width={size.w} height={size.h} className={vertical ? 'mx-auto block max-h-[70vh] w-auto max-w-full' : 'block w-full'} />
      </div>
      {mode && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-gold" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {mode === 'record' && <p className="mt-2 text-sm">מקליט את הסרט… להשאיר את המסך פתוח עד הסוף.</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {mode ? (
          <button className="btn" onClick={() => player.current?.stop()}>עצירה</button>
        ) : (
          <>
            <button className="btn" disabled={!urls.length} onClick={() => start(false)}>▶ לצפות</button>
            <button className="btn btn-main" disabled={!urls.length} onClick={() => start(true)}>להכין קובץ אחד להורדה</button>
          </>
        )}
        {film && !mode && (
          <>
            <button className="btn btn-main" onClick={() => shareBlob(film, name())}>שיתוף הסרט</button>
            <button className="btn" onClick={() => downloadBlob(film, name())}>הורדת הסרט</button>
          </>
        )}
      </div>
    </section>
  );
}
