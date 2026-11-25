// המשרד: קומה במגדל בלילה, משרד לכל בוט ומשרד גדול למנהל (ציור SVG איזומטרי, בלי תמונות חיצוניות).
// בוט שעובד – האורות דולקים והמסך זוהר. בוט שהעביר אליו עבודה "הולך" אליו: התמונה שלו נכנסת למשרד,
// והמשרד שלו נשאר ריק עם שלט "אצל ...". לחיצה על משרד פותחת שיחה עם הבוט.
// הכול "חי" (אנימציות CSS ב-index.css, מחלקות o-*): אורות העיר מנצנצים, מטוס חולף, העציץ מתנדנד,
// בוט פנוי מסתובב לאט בחדר, ובוט שעובד מקליד – המסכים זזים, הקפה מעלה אדים ובועה "..." מעליו.
import { hueOf, photoOf } from '../lib/agents';
import { Spinner } from './ui';

// קווי מתאר של החדר (viewBox 0 0 200 160): קיר שמאל, קיר ימין, רצפה
const LEFT_WALL = '100,18 100,74 20,114 20,58';
const RIGHT_WALL = '100,18 180,58 180,114 100,74';
const FLOOR = '100,74 180,114 100,154 20,114';

function Face({ agent, className = '', style }) {
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-full border-2 bg-[#141a2e] ${className}`} style={style}>
      {photoOf(agent.key) ? (
        <img src={photoOf(agent.key)} alt="" className="h-full w-full object-cover" decoding="async" loading="lazy" />
      ) : (
        <span className="text-[min(7cqw,2rem)] leading-none">{agent.emoji}</span>
      )}
    </span>
  );
}

// החלק האחורי: קירות, חלון עם העיר, מסך על הקיר, רצפה ואור
function Back({ hue, lit, id, big, seed }) {
  const neon = `hsl(${hue} 90% 62%)`;
  return (
    <svg viewBox="0 0 200 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`fl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3527" />
          <stop offset="1" stopColor="#2a1d16" />
        </linearGradient>
        <linearGradient id={`win-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1638" />
          <stop offset="1" stopColor="#1d2f66" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={neon} stopOpacity={lit ? 0.45 : 0.12} />
          <stop offset="1" stopColor={neon} stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon points={LEFT_WALL} fill="#1f2438" />
      <polygon points={RIGHT_WALL} fill="#272d46" />
      <polygon points={FLOOR} fill={`url(#fl-${id})`} />
      {/* חלון לעיר בקיר השמאלי */}
      <polygon points="30,60 90,30 90,62 30,92" fill={`url(#win-${id})`} stroke="#0e1222" strokeWidth="1.2" />
      {[[36, 74, 12], [44, 68, 18], [52, 66, 14], [60, 58, 20], [70, 54, 16], [80, 46, 22]].map(([x, y, h], i) => (
        <polygon key={i} points={`${x},${y} ${x + 6},${y - 3} ${x + 6},${y - 3 + h} ${x},${y + h}`} fill="#0f1a3d" opacity="0.9" />
      ))}
      {[[39, 76], [47, 70], [55, 69], [63, 62], [73, 58], [83, 50], [62, 70], [84, 58]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1.4" height="1.4" fill="#ffd98a" className="o-twinkle" style={{ animationDelay: `${(i * 0.7 + seed) % 5}s` }} />
      ))}
      <circle cx="30" cy="66" r="0.9" fill="#ff6b6b" className="o-fly" style={{ animationDelay: `${seed * 1.7}s` }} />
      {/* מסך על הקיר הימני */}
      <polygon points="116,40 156,60 156,80 116,60" fill="#0d1226" stroke={neon} strokeOpacity={lit ? 0.9 : 0.35} strokeWidth="1" />
      {lit ? (
        <g stroke={neon} strokeWidth="1.2" fill="none" opacity="0.85">
          <polyline points="120,54 128,55 134,52 142,60 152,62" className="o-draw" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={124 + i * 7} y1={68 + i * 3.5} x2={124 + i * 7} y2={62 + i * 3.5} strokeWidth="2.4" className="o-bar" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      ) : (
        <circle cx="136" cy="60" r="2" fill={neon} className="o-breathe" />
      )}
      {big && (
        <polygon points="160,68 174,75 174,92 160,85" fill="#0d1226" stroke={neon} strokeOpacity={lit ? 0.9 : 0.35} strokeWidth="1" />
      )}
      {/* פסי ניאון לאורך הקירות */}
      <polyline points="20,58 100,18 180,58" fill="none" stroke={neon} strokeWidth="1.6" strokeOpacity={lit ? 1 : 0.4} className={lit ? 'o-neon' : ''} />
      <polyline points="20,114 100,74 180,114" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />
      <ellipse cx="100" cy="112" rx="70" ry="34" fill={`url(#glow-${id})`} />
    </svg>
  );
}

// החלק הקדמי: שולחן עם מחשב, עציץ (מעל הדמות שיושבת מאחורי השולחן)
function Front({ hue, lit, big, seed }) {
  const neon = `hsl(${hue} 90% 62%)`;
  return (
    <svg viewBox="0 0 200 160" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {/* שולחן */}
      <polygon points="72,108 100,122 100,132 72,118" fill="#3b2a20" />
      <polygon points="100,122 128,108 128,118 100,132" fill="#2c1f18" />
      <polygon points="100,94 128,108 100,122 72,108" fill="#6b4a35" />
      {/* מחשב נייד על השולחן */}
      <polygon points="92,104 106,111 106,103 92,96" fill="#10162c" stroke={neon} strokeOpacity={lit ? 0.9 : 0.3} strokeWidth="0.8" />
      {lit && <polygon points="93.5,103 104.5,108.6 104.5,103.6 93.5,98" fill={neon} className="o-flicker" />}
      {/* ספל קפה – אדים כשעובדים */}
      <rect x="111" y="104" width="4" height="4" rx="1" fill="#e8e2d6" />
      {lit && (
        <g stroke="#cfd6ea" strokeWidth="0.7" fill="none" strokeLinecap="round">
          <path d="M112 102 q-1 -2 0 -4 q1 -2 0 -4" className="o-steam" />
          <path d="M114 102 q1 -2 0 -4 q-1 -2 0 -4" className="o-steam" style={{ animationDelay: '0.9s' }} />
        </g>
      )}
      <polygon points="106,111 116,106 102,99 92,104" fill="#2b3150" opacity="0.8" />
      {/* מנורה קטנה */}
      <line x1="80" y1="108" x2="80" y2="100" stroke="#c9b28a" strokeWidth="1" />
      <circle cx="80" cy="99" r="2.2" fill={lit ? '#ffd98a' : '#8a7a5e'} />
      {/* עציץ בפינה */}
      <polygon points="150,124 158,120 158,128 150,132" fill="#3a3f55" />
      <polygon points="158,120 166,124 166,132 158,128" fill="#2c3044" />
      <g className="o-sway" style={{ animationDelay: `${seed}s` }}>
        <circle cx="158" cy="114" r="7" fill="#2f7a4f" />
        <circle cx="153" cy="111" r="4.5" fill="#3d9a63" />
        <circle cx="163" cy="110" r="4" fill="#358a59" />
      </g>
      {big && (
        <g>
          {/* פינת ישיבות במשרד המנהל */}
          <ellipse cx="46" cy="124" rx="14" ry="7" fill="#5a3f2e" />
          <circle cx="34" cy="132" r="3" fill="#20263c" />
          <circle cx="58" cy="132" r="3" fill="#20263c" />
          <circle cx="46" cy="116" r="3" fill="#20263c" />
        </g>
      )}
    </svg>
  );
}

export function Room({ agent, agents, visitor, away, big, onClick }) {
  const hue = hueOf(agent.key, agents);
  const lit = agent.busy;
  // השהיה שונה לכל חדר, כדי שהחדרים לא יזוזו יחד
  const seed = (agents.findIndex((a) => a.key === agent.key) * 1.3) % 6;
  return (
    <button
      onClick={onClick}
      aria-label={`שיחה עם ${agent.name}`}
      className={`group flex flex-col items-center text-center transition ${lit ? '' : 'opacity-90 hover:opacity-100'}`}
    >
      <span className="relative block w-full" style={{ aspectRatio: '200 / 160', containerType: 'inline-size' }}>
        <Back hue={hue} lit={lit} id={agent.key} big={big} seed={seed} />
        {/* הבוט ליד השולחן (או ריק כשהלך לבוט אחר) */}
        {away ? (
          <span className="absolute left-1/2 top-[44%] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 sm:text-xs">
            אצל {away.name}
          </span>
        ) : (
          <span className="absolute left-1/2 top-[36%] w-[24%] -translate-x-1/2" style={{ aspectRatio: '1' }}>
            {/* פנוי – מסתובב לאט בחדר; עובד – יושב ומקליד */}
            <span className={`absolute inset-0 ${lit ? 'o-type' : 'o-wander'}`} style={{ animationDelay: `-${seed * 2}s` }}>
              {lit && <span className="pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: `hsl(${hue} 90% 62%)` }} />}
              <Face agent={agent} className="h-full w-full" style={{ borderColor: `hsl(${hue} 85% 60%)`, boxShadow: lit ? `0 0 14px hsl(${hue} 90% 60% / 0.7)` : 'none' }} />
              {lit && (
                <span className="absolute -top-[30%] -right-[45%] flex gap-[3px] rounded-full bg-white px-1.5 py-1 shadow">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="o-dot block h-[4px] w-[4px] rounded-full bg-[#141a2e]" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
              )}
            </span>
          </span>
        )}
        {visitor && (
          <span className="office-walk absolute left-[20%] top-[50%] w-[18%]" style={{ aspectRatio: '1' }} title={`${visitor.name} הגיע`}>
            <Face agent={visitor} className="h-full w-full" style={{ borderColor: `hsl(${hueOf(visitor.key, agents)} 85% 60%)` }} />
          </span>
        )}
        <Front hue={hue} lit={lit} big={big} seed={seed} />
      </span>
      {/* שלט עם השם */}
      <span className="-mt-1 flex max-w-full flex-col items-center rounded-lg border px-2 py-0.5" style={{ borderColor: `hsl(${hue} 80% 60% / 0.6)`, background: 'rgb(10 14 30 / 0.8)' }}>
        <span className={`font-bold leading-tight text-white ${big ? 'text-base lg:text-lg' : 'text-xs sm:text-sm'}`}>{agent.name}</span>
        <span className={`leading-tight text-white/65 ${big ? 'text-xs' : 'hidden text-[11px] sm:line-clamp-2'}`}>{agent.short}</span>
        {lit && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: `hsl(${hue} 95% 75%)` }}>
            <Spinner size={10} /> עובד…
          </span>
        )}
      </span>
    </button>
  );
}

// קו רקיע של העיר בלילה מאחורי הקומה
// מטוס עם אור מהבהב שחוצה את השמיים, וענן שזז לאט
export function Sky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="o-cloud absolute top-[8%] h-16 w-72 rounded-full bg-white/[0.04] blur-2xl" />
      <span className="o-plane absolute top-[5%] flex items-center gap-1">
        <span className="o-blink block h-1.5 w-1.5 rounded-full bg-[#ff6b6b]" />
        <span className="block h-1 w-1 rounded-full bg-white/80" />
      </span>
    </div>
  );
}

export function Skyline() {
  const towers = [[0, 60], [6, 40], [11, 70], [18, 30], [24, 55], [31, 20], [36, 48], [43, 65], [49, 25], [55, 50], [62, 35], [68, 62], [74, 18], [80, 45], [86, 58], [92, 32], [97, 52]];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-70" aria-hidden="true">
      {towers.map(([x, top], i) => (
        <rect key={i} x={x} y={top} width="5.5" height={100 - top} fill={i % 2 ? '#0d1533' : '#111b40'} />
      ))}
      {towers.map(([x, top], i) => (
        <rect key={`w${i}`} x={x + 2} y={top + 6} width="0.8" height="0.8" fill="#ffd98a" className="o-twinkle" style={{ animationDelay: `${(i * 0.9) % 6}s` }} />
      ))}
    </svg>
  );
}
