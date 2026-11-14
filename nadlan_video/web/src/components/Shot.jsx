import { useEffect, useState } from 'react';
import { getMedia } from '../lib/store';
import { dataUrl, downloadBlob, shareBlob, fileName, videoExt } from '../lib/image';
import { shotState, waitText } from '../lib/shots';

const SOURCE = { photo: 'מהצילום', plan: 'מהשרטוט' };

// שוט אחד: הפריים, הסרטון, והכפתורים לפי המצב
export default function Shot({ index, shot, project, busy, onStill, onClip, onRedoStill, onRedoClip, onExtra }) {
  const [frame, setFrame] = useState('');
  const [clip, setClip] = useState(null); // { url, blob }
  const state = shotState(shot, busy);
  const [now, setNow] = useState(Date.now());

  // שעון להמתנה לסרטון
  useEffect(() => {
    if (state !== 'filming') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
    };
  }, [state]);
  const waited = shot.opAt ? waitText(now - shot.opAt) : '';
  const late = shot.opAt > 0 && now - shot.opAt > 5 * 60 * 1000;
  const vertical = project.brief.aspect === '9:16';

  // הפריים שמוצג: זה שנוצר לשוט, או התמונה המקורית
  useEffect(() => {
    let on = true;
    getMedia(shot.hasStill ? `${shot.id}:still` : `${project.id}:${shot.source}`).then((im) => { if (on) setFrame(dataUrl(im)); }).catch(() => {});
    return () => {
      on = false;
    };
  }, [shot.id, shot.hasStill, shot.source, project.id]);

  useEffect(() => {
    let url = '';
    let on = true;
    if (shot.hasClip) {
      getMedia(`${shot.id}:clip`).then((blob) => {
        if (!on || !blob) return;
        url = URL.createObjectURL(blob);
        setClip({ url, blob });
      }).catch(() => {});
    } else {
      setClip(null);
    }
    return () => {
      on = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [shot.id, shot.hasClip]);

  const name = () => `${fileName(project.name, ` - שוט ${index + 1}`)}.${videoExt(clip?.blob.type)}`;
  const box = vertical ? 'mx-auto aspect-[9/16] max-h-[70vh]' : 'aspect-video w-full';

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="relative bg-soft">
        {state === 'done' && clip ? (
          <video src={clip.url} controls playsInline loop className={`${box} bg-black object-contain`} />
        ) : frame ? (
          <img src={frame} alt="" className={`${box} object-cover ${state === 'needs-still' || state === 'making-still' ? 'opacity-60' : ''}`} />
        ) : (
          <div className={box} />
        )}
        {(state === 'needs-still' || state === 'making-still') && (
          <span className="absolute start-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">התמונה המקורית ({SOURCE[shot.source]})</span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold"><span className="text-gold">{index + 1}.</span> {shot.title}</h3>
        <p className="text-sm text-muted">{shot.why}</p>

        {shot.error && (
          <div role="alert" className="mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad">
            <p>{shot.error}</p>
            {shot.detail && <p dir="ltr" className="mt-1 text-xs opacity-80">{shot.detail}</p>}
          </div>
        )}

        {state === 'making-still' && (
          <p className="mt-3 flex items-center gap-2 text-sm"><span className="spinner" /> מכין פריים פוטוריאליסטי… (עד דקה)</p>
        )}
        {state === 'filming' && (
          <div className="mt-3 text-sm">
            <p className="flex items-center gap-2"><span className="spinner" /> הסרטון בהכנה{waited ? ` – עברו ${waited}` : ''}. בדרך כלל דקה עד שלוש.</p>
            <p className="mt-1 text-muted">זה קורה בשרת: אפשר לסגור את האפליקציה ולחזור אחר כך, הסרטון יחכה כאן.</p>
            {late && <p className="mt-1 text-bad">זה לוקח יותר מהרגיל. אם אין סרטון אחרי 10 דקות – כדאי ליצור אותו שוב.</p>}
          </div>
        )}
        {state === 'ready-to-film' && shot.still && !shot.error && (
          <p className="mt-3 rounded-xl bg-soft p-3 text-sm">
            <strong>הפריים מוכן.</strong> אם הוא נאמן לבניין – לחצו "להפוך לסרטון". הסרטון לא מתחיל לבד.
          </p>
        )}

        {(state === 'needs-still' || state === 'ready-to-film') && (
          <div className="mt-3">
            <label className="text-sm text-muted" htmlFor={`extra-${shot.id}`}>בקשה מיוחדת לשוט (לא חובה)</label>
            <input id={`extra-${shot.id}`} className="field mt-1" maxLength={200} value={shot.extra} onChange={(e) => onExtra(e.target.value)} placeholder="למשל: בלי מכוניות, יותר ירוק" />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {state === 'needs-still' && <button className="btn btn-main" onClick={onStill}>להכין פריים</button>}
          {state === 'ready-to-film' && <button className="btn btn-main" onClick={onClip}>להפוך לסרטון</button>}
          {state === 'ready-to-film' && shot.still && <button className="btn" onClick={onRedoStill}>פריים אחר</button>}
          {state === 'done' && clip && (
            <>
              <button className="btn btn-main" onClick={() => shareBlob(clip.blob, name())}>שיתוף</button>
              <button className="btn" onClick={() => downloadBlob(clip.blob, name())}>הורדה</button>
              <button className="btn" onClick={onRedoClip}>ליצור שוב</button>
            </>
          )}
        </div>
        {state === 'done' && shot.resolution && <p className="mt-2 text-xs text-muted">8 שניות · {shot.resolution}</p>}
      </div>
    </li>
  );
}
