// מודל הסט: החלקים, הקול, ובניית סט מאפשרויות. הכול פונקציות טהורות (נבדקות ב-kit.test.js)

// כל חלק אפשרי בסט: תווית, סוג הצליל, מקש במקלדת (לפי e.code, עובד גם במקלדת עברית)
export const PIECES = {
  kick: { label: 'בס', type: 'kick', code: 'Space', hint: 'רווח' },
  kick2: { label: 'בס 2', type: 'kick', code: 'KeyB', hint: 'B' },
  snare: { label: 'סנר', type: 'snare', code: 'KeyJ', hint: 'J' },
  hihat: { label: 'היי-האט', type: 'hihat', code: 'KeyF', hint: 'F' },
  hihatOpen: { label: 'פתוח', type: 'hihatOpen', code: 'KeyG', hint: 'G' },
  tom1: { label: 'טום 1', type: 'tom', code: 'KeyU', hint: 'U' },
  tom2: { label: 'טום 2', type: 'tom', code: 'KeyI', hint: 'I' },
  tom3: { label: 'טום 3', type: 'tom', code: 'KeyO', hint: 'O' },
  tom4: { label: 'טום 4', type: 'tom', code: 'KeyP', hint: 'P' },
  floor1: { label: 'רצפה', type: 'floor', code: 'KeyK', hint: 'K' },
  floor2: { label: 'רצפה 2', type: 'floor', code: 'KeyL', hint: 'L' },
  crash1: { label: 'קראש', type: 'crash', code: 'KeyQ', hint: 'Q' },
  crash2: { label: 'קראש 2', type: 'crash', code: 'KeyW', hint: 'W' },
  china: { label: "צ'יינה", type: 'china', code: 'KeyE', hint: 'E' },
  splash: { label: 'ספלאש', type: 'splash', code: 'KeyR', hint: 'R' },
  cowbell: { label: 'פעמון', type: 'cowbell', code: 'KeyT', hint: 'T' },
  ride: { label: 'רייד', type: 'ride', code: 'KeyY', hint: 'Y' },
};
export const PIECE_IDS = Object.keys(PIECES);
// חלקים שחייבים להיות בכל סט
export const REQUIRED = ['kick', 'snare', 'hihat'];

export function isPiece(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PIECES, id);
}

// איזה חלק מוקש על מקש (e.code), רק מתוך החלקים שבסט
export function pieceForCode(pieces, code) {
  return pieces.find((id) => PIECES[id]?.code === code) || null;
}

// הגדרות קול: כפולות סביב 1 (1 = הצליל הרגיל), כל אחת בטווח מותר
export const DEFAULT_VOICE = {
  kickTune: 1, kickDecay: 1, kickClick: 0.5,
  snareTune: 1, snareDecay: 1, snareSnap: 1,
  tomTune: 1, tomDecay: 1,
  cymDecay: 1, cymBright: 1,
};
export const VOICE_RANGES = {
  kickTune: [0.6, 1.5], kickDecay: [0.4, 2], kickClick: [0, 1.5],
  snareTune: [0.7, 1.5], snareDecay: [0.4, 2], snareSnap: [0.3, 1.8],
  tomTune: [0.6, 1.5], tomDecay: [0.4, 2],
  cymDecay: [0.4, 2], cymBright: [0.6, 1.6],
};

export function safeVoice(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const k of Object.keys(DEFAULT_VOICE)) {
    const [lo, hi] = VOICE_RANGES[k];
    const v = typeof r[k] === 'number' && Number.isFinite(r[k]) ? r[k] : DEFAULT_VOICE[k];
    out[k] = Math.min(hi, Math.max(lo, v));
  }
  return out;
}

// אופי הבס והסנר בבונה הסטים. keep = להשאיר את הקול של הסט שממנו התחלנו
export const KICK_CHARS = {
  keep: { label: 'כמו בסט', voice: null },
  deep: { label: 'עמוק וגדול', voice: { kickTune: 0.75, kickDecay: 1.4, kickClick: 0.3 } },
  tight: { label: 'הדוק וקצר', voice: { kickTune: 1.2, kickDecay: 0.6, kickClick: 0.9 } },
  vintage: { label: 'וינטג׳ חם', voice: { kickTune: 1, kickDecay: 0.8, kickClick: 0.15 } },
  punchy: { label: 'חד ופאנצ׳י', voice: { kickTune: 0.95, kickDecay: 0.9, kickClick: 1.2 } },
};
export const SNARE_CHARS = {
  keep: { label: 'כמו בסט', voice: null },
  deep: { label: 'עמוק ושמן', voice: { snareTune: 0.8, snareDecay: 1.2, snareSnap: 1 } },
  tight: { label: 'הדוק וגבוה', voice: { snareTune: 1.25, snareDecay: 0.7, snareSnap: 1.2 } },
  vintage: { label: 'וינטג׳ יבש', voice: { snareTune: 0.9, snareDecay: 0.6, snareSnap: 0.7 } },
  crisp: { label: 'פריך וחד', voice: { snareTune: 1.15, snareDecay: 0.9, snareSnap: 1.5 } },
};

// אפשרויות הבונה (ספירות בטווחים קבועים)
export const OPTION_LIMITS = { toms: [0, 4], floors: [0, 2], crashes: [0, 2] };
export const DEFAULT_OPTIONS = {
  toms: 2, floors: 1, crashes: 1, ride: true, china: false, splash: false,
  cowbell: false, doubleKick: false, kickChar: 'keep', snareChar: 'keep',
};

function clampInt(v, [lo, hi], def) {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(hi, Math.max(lo, n));
}

export function safeOptions(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_OPTIONS;
  const bool = (k) => (typeof r[k] === 'boolean' ? r[k] : d[k]);
  return {
    toms: clampInt(r.toms, OPTION_LIMITS.toms, d.toms),
    floors: clampInt(r.floors, OPTION_LIMITS.floors, d.floors),
    crashes: clampInt(r.crashes, OPTION_LIMITS.crashes, d.crashes),
    ride: bool('ride'), china: bool('china'), splash: bool('splash'),
    cowbell: bool('cowbell'), doubleKick: bool('doubleKick'),
    kickChar: Object.prototype.hasOwnProperty.call(KICK_CHARS, r.kickChar) ? r.kickChar : d.kickChar,
    snareChar: Object.prototype.hasOwnProperty.call(SNARE_CHARS, r.snareChar) ? r.snareChar : d.snareChar,
  };
}

// מאפשרויות ← רשימת חלקים (תמיד בבס, סנר והיי-האט)
export function buildPieces(options) {
  const o = safeOptions(options);
  const p = ['kick'];
  if (o.doubleKick) p.push('kick2');
  p.push('snare', 'hihat', 'hihatOpen');
  for (let i = 1; i <= o.toms; i++) p.push('tom' + i);
  for (let i = 1; i <= o.floors; i++) p.push('floor' + i);
  for (let i = 1; i <= o.crashes; i++) p.push('crash' + i);
  if (o.ride) p.push('ride');
  if (o.china) p.push('china');
  if (o.splash) p.push('splash');
  if (o.cowbell) p.push('cowbell');
  return p;
}

// ההפך: מרשימת חלקים של סט מפורסם ← אפשרויות לבונה (כדי להתחיל ממנו ולערוך)
export function optionsFromPieces(pieces) {
  const has = (id) => pieces.includes(id);
  const count = (prefix, max) => {
    let n = 0;
    for (let i = 1; i <= max; i++) if (has(prefix + i)) n = i;
    return n;
  };
  return safeOptions({
    toms: count('tom', 4), floors: count('floor', 2), crashes: count('crash', 2),
    ride: has('ride'), china: has('china'), splash: has('splash'),
    cowbell: has('cowbell'), doubleKick: has('kick2'),
    kickChar: 'keep', snareChar: 'keep',
  });
}

// הקול הסופי: הקול הבסיסי של הסט + אופי הבס והסנר שנבחרו
export function applyChars(baseVoice, options) {
  const o = safeOptions(options);
  return safeVoice({ ...safeVoice(baseVoice), ...(KICK_CHARS[o.kickChar].voice || {}), ...(SNARE_CHARS[o.snareChar].voice || {}) });
}

let counter = 0;
function newId() {
  counter += 1;
  return 'my-' + Date.now().toString(36) + counter;
}

// סט שמור (מ-localStorage): כל שדה חסר מקבל ברירת מחדל, כדי שנתונים ישנים לא ישברו כלום
export function safeKit(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const options = safeOptions(r.options);
  const baseVoice = safeVoice(r.baseVoice);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : 'הסט שלי',
    desc: typeof r.desc === 'string' ? r.desc.slice(0, 200) : '',
    custom: true,
    options,
    baseVoice,
    pieces: buildPieces(options),
    voice: applyChars(baseVoice, options),
  };
}
