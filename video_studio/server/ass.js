// טקסטים וכתוביות -> קובץ ASS שה-ffmpeg (libass) צורב על הווידאו. libass יודע עברית מימין לשמאל.
// התצוגה בדפדפן (web/player.js) מציירת את אותם סגנונות ב-CSS – שינוי כאן מחייב שינוי שם.
import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from './store.js';
import { clipEnd } from './edit.js';

// הגופנים שבתיקיית fonts: שם המשפחה + היחס בין גודל ב-ASS לגודל ב-CSS (libass מודד לפי גובה השורה של הגופן)
function readFont(file) {
  const b = fs.readFileSync(file);
  const tables = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const upm = b.readUInt16BE(tables.head + 18);
  let asc = b.readUInt16BE(tables['OS/2'] + 74);
  let desc = b.readUInt16BE(tables['OS/2'] + 76);
  if (!asc && !desc) { asc = b.readInt16BE(tables.hhea + 4); desc = -b.readInt16BE(tables.hhea + 6); }
  return (asc + desc) / upm;
}

const FAMILY = {
  Heebo: 'Heebo', Rubik: 'Rubik', Assistant: 'Assistant', SecularOne: 'Secular One', SuezOne: 'Suez One', Alef: 'Alef',
  VarelaRound: 'Varela Round', AmaticSC: 'Amatic SC', Karantina: 'Karantina', FrankRuhlLibre: 'Frank Ruhl Libre',
};

export const FONTS = Object.entries(FAMILY).map(([file, family]) => ({
  family, file: `${file}.ttf`, factor: Math.round(readFont(path.join(DIRS.fonts, `${file}.ttf`)) * 1000) / 1000,
}));
const fontOf = (family) => FONTS.find((f) => f.family === family) || FONTS[0];

const time = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const p = (n) => String(n).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${p(Math.floor(cs / 6000) % 60)}:${p(Math.floor(cs / 100) % 60)}.${p(cs % 100)}`;
};
const color = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '') || [0, 'ff', 'ff', 'ff'];
  return `&H${m[3]}${m[2]}${m[1]}&`.toUpperCase();
};
const alpha = (opacity) => `&H${Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase()}&`;
const esc = (s) => String(s).replace(/\\/g, '/').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N');
const n1 = (x) => Math.round(x * 10) / 10;

// תגיות המראה המשותפות לטקסט ולכתוביות.
// קופסה מאחורי הטקסט מצוירת כשורה נפרדת (אותו טקסט, שקוף, בסגנון BorderStyle=3) – כך היא אחידה גם כשמילה מודגשת בצבע אחר.
function look(s, W, H) {
  const font = fontOf(s.font);
  const px = (s.size / 100) * H; // גודל האות בפיקסלים, כמו font-size ב-CSS
  const face = `\\fn${font.family}\\fs${n1(px * font.factor)}`;
  if (s.box) {
    return {
      tags: `${face}\\1c${color(s.color)}\\bord0\\shad0`,
      box: `${face}\\1a&HFF&\\3c${color(s.boxColor)}\\3a${alpha(s.boxOpacity ?? 0.75)}\\bord${n1(px * 0.22)}\\shad0`,
    };
  }
  let tags = `${face}\\1c${color(s.color)}\\3c${color(s.outlineColor)}\\bord${n1((px * (s.outline || 0)) / 100)}`;
  tags += s.shadow ? `\\shad${n1(px * 0.05)}\\4c&H000000&\\4a&H73&` : '\\shad0';
  return { tags, box: null };
}

const ANIM_MS = 280;
function animTags(anim, x, y, H, durMs) {
  const d = Math.min(ANIM_MS, durMs / 2);
  const pos = `\\an5\\pos(${n1(x)},${n1(y)})`;
  switch (anim) {
    case 'fade': return `${pos}\\fad(${d},${d})`;
    case 'slide': return `\\an5\\move(${n1(x)},${n1(y + H * 0.05)},${n1(x)},${n1(y)},0,${d})\\fad(${d},0)`;
    case 'pop': return `${pos}\\fscx40\\fscy40\\t(0,${d},\\fscx100\\fscy100)\\fad(${Math.round(d / 2)},0)`;
    case 'zoom': return `${pos}\\fscx150\\fscy150\\t(0,${d},\\fscx100\\fscy100)\\fad(${d},0)`;
    default: return pos;
  }
}

export function buildAss(p, W, H) {
  const lines = [];
  const plain = (text) => text.replace(/\{[^}]*\}/g, '');
  // put: שורה אחת על המסך; אם יש קופסה – היא נכנסת בשכבה שמתחת
  const put = (a, b, pos, lk, text) => {
    if (b <= a + 0.005) return;
    if (lk.box) lines.push(`Dialogue: 0,${time(a)},${time(b)},B,,0,0,0,,{${pos}${lk.box}}${plain(text)}`);
    lines.push(`Dialogue: 1,${time(a)},${time(b)},T,,0,0,0,,{${pos}${lk.tags}}${text}`);
  };
  const hidden = new Set(p.tracks.filter((t) => t.hidden).map((t) => t.id));
  const clips = p.clips.filter((c) => !hidden.has(c.trackId)).sort((a, b) => a.start - b.start);

  // שכבות טקסט: התחתונה נצרבת ראשונה
  const textTracks = p.tracks.filter((t) => t.kind === 'text').map((t) => t.id).reverse();
  for (const c of clips.filter((x) => x.type === 'text').sort((a, b) => textTracks.indexOf(a.trackId) - textTracks.indexOf(b.trackId))) {
    put(c.start, clipEnd(c), animTags(c.anim, c.x * W, c.y * H, H, c.duration * 1000), look(c, W, H), esc(c.text));
  }

  const cs = p.captionStyle;
  const lk = look(cs, W, H);
  const pos = `\\an5\\pos(${n1(W / 2)},${n1(cs.y * H)})`;
  const hi = `{\\1c${color(cs.highlight)}}`;
  const base = `{\\1c${color(cs.color)}}`;
  for (const c of clips.filter((x) => x.type === 'caption')) {
    const words = c.words || [];
    if (cs.mode === 'none' || !words.length) { put(c.start, clipEnd(c), pos, lk, esc(c.text)); continue; }
    words.forEach((w, i) => {
      const a = i === 0 ? c.start : c.start + w.s;
      const b = i === words.length - 1 ? clipEnd(c) : c.start + words[i + 1].s;
      let text;
      if (cs.mode === 'single') text = esc(w.w);
      else if (cs.mode === 'karaoke') text = hi + words.slice(0, i + 1).map((x) => esc(x.w)).join(' ') + base + (i < words.length - 1 ? ' ' + words.slice(i + 1).map((x) => esc(x.w)).join(' ') : '');
      else text = words.map((x, j) => (j === i ? hi + esc(x.w) + base : esc(x.w))).join(' ');
      put(a, b, pos, lk, text);
    });
  }
  if (!lines.length) return null;

  const style = (name, border) => `Style: ${name},Heebo,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,${border},0,0,5,0,0,0,-1`;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${style('T', 1)}
${style('B', 3)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}
`;
}
