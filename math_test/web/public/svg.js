// עזרי ציור SVG. הצבעים לפי משתני CSS (מצב יום/לילה), הקווים והכיתוב ב-currentColor
export const COL = {
  a: 'var(--s1, #3b82f6)', b: 'var(--s2, #f59e0b)', c: 'var(--s3, #10b981)', d: 'var(--s4, #ec4899)',
  soft: 'var(--svgsoft, #dbeafe)', ink: 'currentColor',
};
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// מעטפת: direction=ltr כדי שהכיתוב והמספרים ייושרו נכון (העברית בפנים עדיין מימין לשמאל)
export function svg(w, h, inner, label = 'ציור', scale = 1) {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" direction="ltr" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto" font-size="14" fill="currentColor">${inner}</svg>`;
}
export function txt(x, y, s, { anchor = 'middle', size = 14, fill = COL.ink, weight = 400 } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
}
export const line = (x1, y1, x2, y2, { stroke = COL.ink, width = 1.5, dash = '' } = {}) =>
  `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
export const rect = (x, y, w, h, { fill = 'none', stroke = COL.ink, width = 1.5 } = {}) =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
export const circle = (cx, cy, r, { fill = 'none', stroke = COL.ink, width = 1.5 } = {}) =>
  `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
export const poly = (pts, { fill = COL.soft, stroke = COL.ink, width = 2 } = {}) =>
  `<polygon points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;

// נקודות של מצולע משוכלל (או כמעט) סביב מרכז
export function regularPts(n, cx, cy, r, startDeg = -90) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
export const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// כיתוב מחוץ למצולע: על כל צלע (נקודה i עד i+1) או ליד כל קודקוד
export function sideLabels(pts, labels, { gap = 13, size = 14 } = {}) {
  const [cx, cy] = centroid(pts);
  return labels.map((l, i) => {
    if (l == null || l === '') return '';
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = mx - cx, dy = my - cy, len = Math.hypot(dx, dy) || 1;
    return txt(mx + (dx / len) * gap, my + (dy / len) * gap + 5, l, { size, weight: 700 });
  }).join('');
}
export function vertexLabels(pts, names, { gap = 14, size = 15 } = {}) {
  const [cx, cy] = centroid(pts);
  return pts.map((p, i) => {
    const dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy) || 1;
    return txt(p[0] + (dx / len) * gap, p[1] + (dy / len) * gap + 5, names[i], { size, weight: 700 });
  }).join('');
}

// ---- שברים ----
// עוגה: n פרוסות צבועות מתוך d
export function pieEl(n, d, cx = 50, cy = 50, r = 40) {
  let out = '';
  for (let i = 0; i < d; i++) {
    const a0 = ((-90 + (360 / d) * i) * Math.PI) / 180, a1 = ((-90 + (360 / d) * (i + 1)) * Math.PI) / 180;
    const path = `M${cx},${cy} L${r1(cx + r * Math.cos(a0))},${r1(cy + r * Math.sin(a0))} A${r},${r} 0 0 1 ${r1(cx + r * Math.cos(a1))},${r1(cy + r * Math.sin(a1))} Z`;
    out += `<path d="${path}" fill="${i < n ? COL.a : COL.soft}" stroke="${COL.ink}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  return out;
}
export const pieSvg = (n, d) => svg(100, 100, pieEl(n, d), `עוגה: ${n} מתוך ${d} חלקים צבועים`, 1.5);

// פס מחולק: n חלקים צבועים מתוך d (במיקום x,y)
export function barEl(n, d, x, y, w = 240, h = 28) {
  let out = '';
  for (let i = 0; i < d; i++) out += rect(x + (w / d) * i, y, w / d, h, { fill: i < n ? COL.a : COL.soft });
  return out;
}
// כמה פסים זה מתחת לזה, כל אחד עם שבר ליד
export function barsSvg(fracs) {
  const rows = fracs.map(([n, d], i) => barEl(n, d, 60, 10 + i * 42) + txt(30, 30 + i * 42, `${n}/${d}`, { size: 16, weight: 700 })).join('');
  return svg(320, 14 + fracs.length * 42, rows, 'פסים מחולקים לחלקים שווים');
}
// ריבועים צבועים (למשל: שלושה ריבועים הם רבע מהשלם)
export function squaresSvg(count, cols = 6) {
  const size = 30, rows = Math.ceil(count / cols);
  let out = '';
  for (let i = 0; i < count; i++) out += rect(8 + (i % cols) * size, 8 + Math.floor(i / cols) * size, size, size, { fill: COL.b });
  return svg(16 + Math.min(count, cols) * size, 16 + rows * size, out, `${count} ריבועים צבועים`);
}

// ---- סרגל ----
// סרגל באורך lenCm עם סימוני מ"מ; פס מ-fromMm עד toMm (במ"מ)
export function rulerSvg(lenCm, fromMm, toMm) {
  const pad = 20, u = 40, w = pad * 2 + lenCm * u, mm = u / 10;
  let out = rect(pad, 44, lenCm * u, 40, { fill: COL.soft });
  for (let i = 0; i <= lenCm * 10; i++) {
    const x = pad + i * mm, len = i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8;
    out += line(x, 44, x, 44 + len, { width: i % 10 === 0 ? 1.8 : 1 });
    if (i % 10 === 0) out += txt(x, 78, String(i / 10), { size: 14, weight: 700 });
  }
  out += rect(pad + fromMm * mm, 12, (toMm - fromMm) * mm, 18, { fill: COL.b });
  out += line(pad + fromMm * mm, 8, pad + fromMm * mm, 44, { dash: '3 3', width: 1 }) + line(pad + toMm * mm, 8, pad + toMm * mm, 44, { dash: '3 3', width: 1 });
  return svg(w, 92, out, 'סרגל ופס שמודדים');
}

// ---- זוויות ----
// זווית deg מעלות, בכיוון rot. זווית ישרה מסומנת בריבוע קטן
export function angleEl(deg, rot, cx, cy, len = 48) {
  const rad = (d) => (d * Math.PI) / 180;
  const p = (d, l) => [cx + l * Math.cos(rad(-d)), cy + l * Math.sin(rad(-d))];
  const a = p(rot, len), b = p(rot + deg, len);
  let out = line(cx, cy, a[0], a[1], { width: 3, stroke: COL.a }) + line(cx, cy, b[0], b[1], { width: 3, stroke: COL.b });
  if (deg === 90) {
    const s = 12, q1 = p(rot, s), q3 = p(rot + 90, s), q2 = [q1[0] + q3[0] - cx, q1[1] + q3[1] - cy];
    out += `<polyline points="${r1(q1[0])},${r1(q1[1])} ${r1(q2[0])},${r1(q2[1])} ${r1(q3[0])},${r1(q3[1])}" fill="none" stroke="${COL.ink}" stroke-width="1.5"/>`;
  } else {
    const r = 16, s0 = p(rot, r), s1 = p(rot + deg, r);
    out += `<path d="M${r1(s0[0])},${r1(s0[1])} A${r},${r} 0 0 0 ${r1(s1[0])},${r1(s1[1])}" fill="none" stroke="${COL.ink}" stroke-width="1.5"/>`;
  }
  return out + circle(cx, cy, 3, { fill: COL.ink });
}
export const angleSvg = (deg, rot) => svg(130, 120, angleEl(deg, rot, 65, 60), 'זווית', 1.5);

// שורה של ציורים עם אות מתחת לכל אחד (א, ב, ג, ד)
export function rowSvg(cells, cw = 90, ch = 90, captions = null) {
  const letters = ['א', 'ב', 'ג', 'ד', 'ה'];
  const out = cells.map((inner, i) => `<g transform="translate(${i * cw},0)">${inner}${txt(cw / 2, ch + 20, letters[i], { size: 17, weight: 700 })}${captions ? txt(cw / 2, ch + 38, captions[i], { size: 13 }) : ''}</g>`).join('');
  return svg(cells.length * cw, ch + (captions ? 46 : 28), out, 'ציורים לבחירה');
}

// ---- דיאגרמות ----
// דיאגרמת עמודות. ציר המספרים כל step, כל עמודה על קו
export function barChartSvg({ title, cats, vals, step }) {
  const W = 360, H = 250, L = 38, R = 10, T = 34, B = 36;
  const top = Math.ceil(Math.max(...vals) / step) * step;
  const ph = H - T - B, pw = W - L - R, slot = pw / cats.length, bw = slot * 0.6;
  const y = (v) => T + ph - (v / top) * ph;
  let out = txt(W / 2, 18, title, { size: 15, weight: 700 });
  for (let t = 0; t <= top; t += step) {
    out += line(L, y(t), W - R, y(t), { width: t === 0 ? 1.8 : 0.7, stroke: t === 0 ? COL.ink : 'var(--line, #cbd5e1)' });
    out += txt(L - 6, y(t) + 4, String(t), { anchor: 'end', size: 12 });
  }
  out += line(L, T, L, T + ph, { width: 1.8 });
  const colors = [COL.a, COL.b, COL.c, COL.d, COL.a];
  cats.forEach((c, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    out += rect(x, y(vals[i]), bw, T + ph - y(vals[i]), { fill: colors[i % 5] });
    out += txt(x + bw / 2, H - 14, c, { size: 13 });
  });
  return svg(W, H, out, `דיאגרמת עמודות: ${title}`);
}
// פיקטוגרמה: כל עיגול שווה per פריטים. התוויות מימין
export function pictogramSvg({ title, cats, vals, per, unit }) {
  const W = 360, rowH = 34, T = 34, n = cats.length, H = T + n * rowH + 34;
  let out = txt(W / 2, 18, title, { size: 15, weight: 700 });
  const colors = [COL.a, COL.b, COL.c, COL.d, COL.a];
  cats.forEach((c, i) => {
    const y = T + i * rowH + rowH / 2;
    out += txt(W - 8, y + 5, c, { anchor: 'end', size: 14, weight: 700 });
    for (let k = 0; k < vals[i] / per; k++) out += circle(W - 84 - k * 26, y, 10, { fill: colors[i % 5] });
    if (i < n - 1) out += line(10, T + (i + 1) * rowH, W - 8, T + (i + 1) * rowH, { width: 0.6, stroke: 'var(--line, #cbd5e1)' });
  });
  out += circle(W - 90, H - 16, 8, { fill: COL.ink }) + txt(W - 104, H - 11, `= ${per} ${unit}`, { anchor: 'end', size: 14 });
  return svg(W, H, out, `פיקטוגרמה: ${title}`);
}
