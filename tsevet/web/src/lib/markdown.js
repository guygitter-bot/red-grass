// מרקדאון קטן ובטוח: **מודגש**, תבליטים ("•" או "- "), פסקאות, וקישורים אוטומטיים.
// מחזיר מערך בלוקים (בלי HTML גולמי), והרכיב Markdown.jsx מצייר אותם.
// בלוק: { type: 'p', inline } או { type: 'ul', items: [inline] }. inline: מערך של { t: 'text'|'bold'|'link', text, href? }

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAIL_RE = /[.,;:!?)\]}־"'״׳]+$/;

// קישורים אוטומטיים בתוך טקסט רגיל
function linkify(text, bold = false) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = url.match(TRAIL_RE);
    if (trail) url = url.slice(0, url.length - trail[0].length);
    if (!url) continue;
    if (m.index > last) out.push({ t: bold ? 'bold' : 'text', text: text.slice(last, m.index) });
    out.push({ t: 'link', text: url, href: url });
    last = m.index + url.length;
  }
  if (last < text.length) out.push({ t: bold ? 'bold' : 'text', text: text.slice(last) });
  return out;
}

// הדגשה בתוך שורה
export function parseInline(line) {
  const out = [];
  const parts = line.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    out.push(...linkify(part, i % 2 === 1));
  });
  return out;
}

export function parseMarkdown(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', lines: para.map(parseInline) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'ul', items: list });
    list = null;
  };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = line.match(/^(?:•|-)\s+(.*)$/);
    if (bullet) {
      flushPara();
      (list ||= []).push(parseInline(bullet[1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
