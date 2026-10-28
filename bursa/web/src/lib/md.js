// מרקדאון פשוט בתשובות הבוט -> מבנה נתונים (הרכיב Md בונה ממנו אלמנטים של React, בלי HTML גולמי)
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<)]+)/g;

export function parseInline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: 'text', text: text.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith('**')) out.push({ t: 'b', text: s.slice(2, -2) });
    else if (s.startsWith('`')) out.push({ t: 'code', text: s.slice(1, -1) });
    else if (s.startsWith('[')) {
      const i = s.indexOf('](');
      out.push({ t: 'a', text: s.slice(1, i), href: s.slice(i + 2, -1) });
    } else {
      // קישור גולמי: בלי סימני פיסוק בסוף
      const href = s.replace(/[.,;:!?]+$/, '');
      out.push({ t: 'a', text: href, href });
      if (href.length < s.length) out.push({ t: 'text', text: s.slice(href.length) });
    }
    last = m.index + s.length;
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) });
  return out;
}

// מחזיר בלוקים: { type: 'p' | 'li' | 'h' | 'gap', inline }
export function parseMd(text) {
  const blocks = [];
  for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'gap') blocks.push({ type: 'gap', inline: [] });
      continue;
    }
    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (heading) blocks.push({ type: 'h', inline: parseInline(heading[1]) });
    else if (bullet) blocks.push({ type: 'li', inline: parseInline(bullet[1]) });
    else blocks.push({ type: 'p', inline: parseInline(trimmed) });
  }
  while (blocks.length && blocks[blocks.length - 1].type === 'gap') blocks.pop();
  return blocks;
}
