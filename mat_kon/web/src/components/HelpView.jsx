import { useEffect, useRef } from 'react';
import { ArrowRight, PlayCircle, X } from 'lucide-react';
import { TUTORIALS } from '../lib/tutorials';

// סרטוני הדרכה: רשימה, ולחיצה פותחת את הסרטון (#/help/<id>)
export default function HelpView({ playing, onBack, onClose }) {
  const current = TUTORIALS.find((t) => t.id === playing);
  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">🎬 סרטוני הדרכה</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <p className="mt-4 text-stone-600 leading-relaxed">סרטונים קצרים שמראים איך משתמשים בכל דבר באפליקציה. לוחצים על סרטון כדי לצפות.</p>
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TUTORIALS.map((t, i) => (
            <li key={t.id}>
              <a href={`#/help/${t.id}`} className="block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition text-right h-full">
                <div className="relative aspect-[3/4] bg-orange-100 flex items-center justify-center">
                  <img src={`tutorials/${t.id}.jpg`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span className="text-5xl">{t.emoji}</span>
                  <PlayCircle size={34} className="absolute bottom-2 left-2 text-white drop-shadow-lg" fill="rgba(249,115,22,.9)" />
                </div>
                <div className="p-2.5">
                  <div className="text-xs text-orange-700 font-medium">מדריך {i + 1}</div>
                  <div className="font-bold text-stone-900 leading-snug">{t.title}</div>
                  <div className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-3">{t.text}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {current && <Player tutorial={current} onClose={onClose} />}
    </div>
  );
}

function Player({ tutorial, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.play().catch(() => {}); // בלי הרשאה לניגון אוטומטי – לוחצים על play
  }, [tutorial.id]);
  const index = TUTORIALS.indexOf(tutorial);
  const next = TUTORIALS[index + 1];
  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-2 px-3 h-12 text-white">
        <div className="flex-1 font-bold truncate">{tutorial.emoji} {tutorial.title}</div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/15" aria-label="סגירה"><X size={22} /></button>
      </div>
      <video
        ref={ref}
        key={tutorial.id}
        src={`tutorials/${tutorial.id}.mp4`}
        poster={`tutorials/${tutorial.id}.jpg`}
        controls
        playsInline
        preload="metadata"
        className="flex-1 min-h-0 w-full object-contain"
      />
      {next && (
        <a href={`#/help/${next.id}`} onClick={(e) => { e.preventDefault(); window.location.replace(`#/help/${next.id}`); }} className="m-3 rounded-2xl bg-white/10 text-white px-4 py-3 text-sm flex items-center justify-between">
          <span>הבא: {next.emoji} {next.title}</span>
          <PlayCircle size={20} />
        </a>
      )}
    </div>
  );
}
