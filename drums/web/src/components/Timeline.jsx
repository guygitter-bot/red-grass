import { PIECES } from '../lib/kit';
import { rowsFor, totalSteps } from '../lib/lesson';

const TYPE_CLASS = { kick: 'tl-kick', snare: 'tl-snare', hihat: 'tl-cym', hihatOpen: 'tl-cym', tom: 'tl-tom', floor: 'tl-tom', crash: 'tl-cym', ride: 'tl-cym', china: 'tl-cym', splash: 'tl-cym', cowbell: 'tl-bell' };

// ציר זמן של הסעיף (תצוגת LCD של שולחן המיקסר) – כמו תווים לתופים מפושטים: שורה לכל חלק, נקודה לכל מכה, סמן נע.
// נכתב משמאל לימין (כמו תווים). הסמן מוזז מבחוץ (playheadRef) בלי רינדור מחדש
export default function Timeline({ section, playheadRef }) {
  const rows = rowsFor(section);
  const n = totalSteps(section);
  const beats = section.bars * 4;
  return (
    <div className="desk px-2 py-1.5 border-b border-black" dir="ltr" aria-label="ציר זמן של הביט" role="img">
      <div className="lcd flex px-1 py-1">
        <div className="shrink-0 w-[4.5rem] flex flex-col" aria-hidden>
          {rows.map((p) => (
            <span key={p} className="tl-row text-[10px] lg:text-xs leading-none text-[#c9b48a] truncate pe-1.5 text-end flex items-center justify-end" dir="ltr">{PIECES[p].label}</span>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          {Array.from({ length: beats + 1 }, (_, i) => (
            <span key={i} className={`absolute top-0 bottom-0 w-px ${i % 4 === 0 ? 'bg-[#ffb21f]/45' : 'bg-white/10'}`} style={{ left: `${(i / beats) * 100}%` }} aria-hidden />
          ))}
          {rows.map((p) => (
            <div key={p} className="tl-row relative">
              {section.hits[p].map((i) => (
                <span key={i} className={`tl-dot ${TYPE_CLASS[PIECES[p].type]}`} style={{ left: `${(i / n) * 100}%` }} />
              ))}
            </div>
          ))}
          <span ref={playheadRef} className="tl-playhead" style={{ left: '0%', opacity: 0 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
