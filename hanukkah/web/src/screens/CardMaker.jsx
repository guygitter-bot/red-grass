import { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context';

const BACKGROUNDS = [
  { id: 'night', name: 'לילה', from: '#0c1538', to: '#2a3f8a', ink: '#ffe9a8' },
  { id: 'gold', name: 'זהב', from: '#ffe08a', to: '#e8962a', ink: '#3b2200' },
  { id: 'sky', name: 'שמיים', from: '#8ecbff', to: '#3b6fd8', ink: '#ffffff' },
  { id: 'flame', name: 'להבה', from: '#ff8a3d', to: '#b02a2a', ink: '#fff6dd' },
];
const SYMBOLS = ['🕎', '🕯️', '🍩', '🌟', '🏺', '🪙', '🥔', '✨'];
const GREETINGS = ['חג חנוכה שמח!', 'חנוכה שמח ומואר!', 'שמונה ימים של אור ושמחה', 'נס גדול היה פה!', 'שיהיה לנו אור בכל יום'];

// מחלק טקסט לשורות קצרות
function wrap(text, max = 16) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max && line) {
      out.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

export default function CardMaker() {
  const { update } = useApp();
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [sym, setSym] = useState(SYMBOLS[0]);
  const [greet, setGreet] = useState(GREETINGS[0]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const lines = wrap(greet);
  const full = `${sym} ${greet}${name.trim() ? `\nמאת ${name.trim()}` : ''}`;

  const share = async () => {
    update((p) => ({ ...p, cards: p.cards + 1 }));
    try {
      if (navigator.share) {
        await navigator.share({ text: full });
        setMsg('נשלח!');
        return;
      }
    } catch {
      // המשתמש ביטל, או שהשיתוף נכשל: מנסים להעתיק
    }
    try {
      await navigator.clipboard.writeText(full);
      setMsg('הברכה הועתקה, אפשר להדביק בהודעה');
    } catch {
      setMsg('לא הצלחנו להעתיק. אפשר להעתיק את הטקסט ידנית.');
    }
  };

  return (
    <Layout title="כרטיס ברכה" back="#/extras">
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="max-w-md w-full mx-auto">
          <svg viewBox="0 0 400 300" className="w-full h-auto rounded-3xl shadow-lg" role="img" aria-label={`כרטיס ברכה: ${greet}`}>
            <defs>
              <linearGradient id="cardbg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={bg.from} />
                <stop offset="100%" stopColor={bg.to} />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#cardbg)" />
            <rect x="10" y="10" width="380" height="280" rx="18" fill="none" stroke={bg.ink} strokeOpacity="0.5" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
            {[[40, 40], [360, 50], [330, 255], [55, 245], [200, 28]].map(([x, y], i) => (
              <text key={i} x={x} y={y} fontSize="18" textAnchor="middle" fill={bg.ink} opacity="0.7">✦</text>
            ))}
            <text x="200" y="118" fontSize="76" textAnchor="middle">{sym}</text>
            {lines.map((l, i) => (
              <text key={i} x="200" y={188 + i * 38} fontSize="32" fontWeight="800" textAnchor="middle" fill={bg.ink} fontFamily="system-ui, Arial, sans-serif">{l}</text>
            ))}
            {name.trim() && (
              <text x="200" y={188 + lines.length * 38 + 10} fontSize="22" textAnchor="middle" fill={bg.ink} fontFamily="system-ui, Arial, sans-serif">מאת {name.trim()}</text>
            )}
          </svg>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div>
            <div className="font-extrabold mb-2">רקע</div>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((b) => (
                <button key={b.id} aria-pressed={bg.id === b.id} onClick={() => setBg(b)} className={`btn btn-sm ${bg.id === b.id ? 'border-accent! bg-soft!' : ''}`}>
                  <span className="inline-block w-5 h-5 rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }} />
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-extrabold mb-2">סמל</div>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((s) => (
                <button key={s} aria-pressed={sym === s} aria-label={`סמל ${s}`} onClick={() => setSym(s)} className={`btn w-12 text-2xl px-0! ${sym === s ? 'border-accent! bg-soft!' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-extrabold mb-2">הברכה</div>
            <div className="flex flex-col gap-2">
              {GREETINGS.map((g) => (
                <button key={g} aria-pressed={greet === g} onClick={() => setGreet(g)} className={`btn justify-start text-start ${greet === g ? 'border-accent! bg-soft!' : ''}`}>{g}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="font-extrabold block mb-2">השם שלכם</span>
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="למשל: נועה" className="w-full min-h-12 rounded-xl border-2 border-line bg-card text-ink px-3 text-lg" />
          </label>
          <button className="btn btn-primary min-h-14 text-lg" onClick={share}>📤 שליחה</button>
          {msg && <p role="status" className="m-0 font-bold text-good">{msg}</p>}
        </div>
      </div>
    </Layout>
  );
}
