import { useState } from 'react';
import { parseYouTubeId } from '../lib/youtube';

// לנגן עם שיר: מדביקים קישור יוטיוב (או מזהה), או בוחרים מהשירים האחרונים
export default function SongScreen({ current, recent, onLoad, onGoPlay }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const id = parseYouTubeId(text);
    if (!id) {
      setError('לא זיהינו קישור יוטיוב. נסו להדביק את הכתובת המלאה של הסרטון.');
      return;
    }
    setError('');
    setText('');
    onLoad(id);
    onGoPlay();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-5">
        <header>
          <h1 className="font-display font-extrabold text-2xl">לנגן עם שיר</h1>
          <p className="text-muted text-sm">הדביקו קישור לשיר מיוטיוב, והתופים שלכם ינגנו יחד איתו.</p>
        </header>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label className="font-semibold" htmlFor="yt">קישור לשיר</label>
          <div className="flex gap-2 flex-wrap">
            <input id="yt" dir="ltr" className="input flex-1 min-w-[200px]" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="btn btn-primary">טעינה ונגינה</button>
          </div>
          {error && <p className="text-bad text-sm" role="alert">{error}</p>}
        </form>
        {current && (
          <p className="text-sm text-muted">השיר הנוכחי נמצא בנגן שמעל התופים. <button type="button" className="underline font-bold text-accent" onClick={onGoPlay}>לחזור לתופים</button></p>
        )}
        <section>
          <h2 className="font-display font-bold text-lg mb-2">שירים אחרונים</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">עוד לא נטען שיר.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.map((s) => (
                <li key={s.id}>
                  <button type="button" className="w-full flex items-center gap-3 rounded-xl border border-line bg-card p-2 text-start" onClick={() => { onLoad(s.id); onGoPlay(); }}>
                    <img src={`https://i.ytimg.com/vi/${s.id}/default.jpg`} alt="" width="80" height="60" loading="lazy" className="rounded-lg bg-line shrink-0 w-20 h-[60px] object-cover" />
                    <span className="font-semibold min-w-0 truncate">{s.title || s.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted">טיפ: חלק מהסרטונים חסומים להטמעה באתרים אחרים – אם כך, נסו גרסה אחרת של השיר. השיר מתנגן מיוטיוב ולא נשמר אצלנו.</p>
      </div>
    </div>
  );
}
