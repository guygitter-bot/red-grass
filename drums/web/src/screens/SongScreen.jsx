import { useState } from 'react';
import Icon from '../components/Icon';
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
    <div className="floor flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-5">
        <header>
          <h1 className="poster text-7xl">לנגן עם שיר</h1>
          <p className="text-muted text-sm mt-1">הדביקו קישור לשיר מיוטיוב, והתופים שלכם ינגנו יחד איתו.</p>
        </header>
        <form onSubmit={submit} className="case p-4 flex flex-col gap-3">
          <label className="tape text-xl self-start" htmlFor="yt">קישור לשיר</label>
          <div className="flex gap-2 flex-wrap">
            <input id="yt" dir="ltr" className="input flex-1 min-w-[200px]" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="btn btn-primary">טעינה ונגינה</button>
          </div>
          {error && <p className="text-bad text-sm" role="alert">{error}</p>}
        </form>
        {current && (
          <p className="text-sm text-muted">השיר הנוכחי נמצא בנגן שמעל התופים. <button type="button" className="underline font-bold text-ink decoration-accent decoration-2" onClick={onGoPlay}>לחזור לתופים</button></p>
        )}
        <section>
          <h2 className="poster text-4xl mb-3">שירים אחרונים</h2>
          {recent.length === 0 ? (
            <p className="case text-sm text-muted p-4 flex items-center gap-2"><Icon name="note" size={18} />עוד לא נטען שיר. הדביקו קישור למעלה והוא יישמר כאן.</p>
          ) : (
            <ul className="setlist flex flex-col gap-1 divide-y divide-[#d9d3c6]">
              {recent.map((s) => (
                <li key={s.id}>
                  <button type="button" className="w-full flex items-center gap-3 py-1.5 text-start" onClick={() => { onLoad(s.id); onGoPlay(); }}>
                    <img src={`https://i.ytimg.com/vi/${s.id}/default.jpg`} alt="" width="80" height="60" loading="lazy" className="rounded-[2px] bg-black/20 shrink-0 w-20 h-[60px] object-cover grayscale-[30%]" />
                    <bdi dir="ltr" className="setlist-title min-w-0 truncate">{s.title || s.id}</bdi>
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
