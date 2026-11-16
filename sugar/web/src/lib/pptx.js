// מצגת PowerPoint מהדוח (אותן שקופיות כמו במסך), עם גרפים אמיתיים שאפשר לערוך. הספרייה pptxgenjs נטענת רק כשמורידים.
// buildDeck מחזיר את אובייקט המצגת (גם לבדיקה ב-node); downloadDeck שומר קובץ במכשיר.
import { level } from './diary';
import { longDate } from './report';

const C = { low: 'DC2626', ok: '16A34A', high: 'F59E0B', accent: '1D5FA8', dark: '0E3A6B', line: 'E1E7EF', muted: '637083', ink: '16202C', page: 'F4F7FB' };
const FONT = 'Arial';
const lvColor = (v, s) => ({ low: C.low, ok: C.ok, high: C.high, veryHigh: C.low })[level(v, s)] || C.muted;
const T = (extra) => ({ fontFace: FONT, color: C.ink, align: 'right', rtlMode: true, valign: 'middle', margin: 0, ...extra });
const num = (v) => (v === '' || v == null ? '—' : String(v));

function frame(pptx, r, title, n, total) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 12.55, y: 0.55, w: 0.12, h: 0.6, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText(title, T({ x: 0.6, y: 0.45, w: 11.8, h: 0.8, fontSize: 30, bold: true }));
  s.addShape(pptx.ShapeType.line, { x: 0.6, y: 6.85, w: 12.1, h: 0, line: { color: C.line, width: 1 } });
  s.addText(`יומן סוכר${r.person ? ` · ${r.person}` : ''} · ${longDate(r.from)} – ${longDate(r.to)}`, T({ x: 3, y: 6.9, w: 9.7, h: 0.35, fontSize: 11, color: C.muted }));
  s.addText(`${n} / ${total}`, T({ x: 0.6, y: 6.9, w: 2, h: 0.35, fontSize: 11, color: C.muted, align: 'left', rtlMode: false }));
  return s;
}

function empty(s) {
  s.addText('אין נתונים בתקופה הזו', T({ x: 0.6, y: 3, w: 12.1, h: 1, fontSize: 24, color: C.muted, align: 'center' }));
}

const axis = { catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, valGridLine: { color: C.line, size: 0.5 } };

function kpiTile(pptx, s, x, y, label, value, unit, hint, c, color) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.85, h: 2.6, fill: { color: C.page }, line: { color: C.line, width: 1 }, rectRadius: 0.15 });
  s.addText(label, T({ x: x + 0.25, y: y + 0.2, w: 3.35, h: 0.45, fontSize: 16, color: C.muted }));
  s.addText(value === '' || value == null ? '—' : `${value}${unit}`, T({ x: x + 0.25, y: y + 0.75, w: 3.35, h: 1, fontSize: 44, bold: true, color: color || C.ink }));
  s.addText(hint || '', T({ x: x + 1.5, y: y + 1.95, w: 2.1, h: 0.4, fontSize: 11, color: C.muted }));
  if (c && c.diff) {
    const col = c.better == null ? C.muted : c.better ? C.ok : C.low;
    s.addText(`${c.diff > 0 ? '▲' : '▼'} ${Math.abs(c.diff)}${unit}`, T({ x: x + 0.25, y: y + 1.95, w: 1.3, h: 0.4, fontSize: 14, bold: true, color: col, align: 'left', rtlMode: false }));
  }
}

export function buildDeck(PptxGenJS, r, ai, periodLabel) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = true;
  pptx.title = `דוח סוכר ${longDate(r.from)} – ${longDate(r.to)}`;
  const st = r.settings;
  const k = r.kpis;
  const p = r.prevKpis;
  const has = k.count > 0;
  const unitName = { day: 'לפי ימים', week: 'לפי שבועות', month: 'לפי חודשים' }[r.unit];
  const total = 10 + (ai ? 1 : 0);
  let n = 1;

  // שער
  const cover = pptx.addSlide();
  cover.background = { color: C.accent };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 5.6, w: 13.33, h: 1.9, fill: { color: C.dark }, line: { color: C.dark } });
  cover.addText('💧 יומן סוכר', T({ x: 0.8, y: 0.6, w: 11.7, h: 0.6, fontSize: 20, color: 'FFFFFF' }));
  cover.addText(`דוח סוכר${r.person ? ` – ${r.person}` : ''}`, T({ x: 0.8, y: 2.1, w: 11.7, h: 1.3, fontSize: 54, bold: true, color: 'FFFFFF' }));
  cover.addText(`${periodLabel} · ${longDate(r.from)} – ${longDate(r.to)}`, T({ x: 0.8, y: 3.5, w: 11.7, h: 0.8, fontSize: 28, color: 'FFFFFF' }));
  cover.addText(`טווח לאורך היום ${st.low}-${st.dayHigh} · לפני ארוחה ${st.low}-${st.high} · הופק ב-${longDate(new Date().toISOString().slice(0, 10))}`, T({ x: 0.8, y: 6.2, w: 11.7, h: 0.6, fontSize: 16, color: 'FFFFFF' }));

  // תמונת מצב
  let s = frame(pptx, r, 'תמונת מצב', ++n, total);
  const tiles = [
    ['זמן בטווח', k.inRange, '%', `${st.low}-${st.dayHigh}`, r.changes.inRange, k.inRange >= 70 ? C.ok : k.inRange >= 50 ? C.high : C.low],
    ['סוכר ממוצע', k.mean, '', `${k.count} מדידות`, r.changes.mean, k.mean === '' ? C.ink : lvColor(k.mean, st)],
    ['מתחת לטווח', k.lowPct, '%', `מתחת ל-${st.low}`, r.changes.lowPct, k.lowPct > 4 ? C.low : C.ok],
    ['תנודות (סטיית תקן)', k.sd, '', 'נמוך = יציב יותר', r.changes.sd],
    ['GMI (הערכה)', k.gmi, '%', 'המוגלובין מסוכרר', r.changes.gmi],
    ['אינסולין ליום', k.insulinPerDay, '', `${k.meals} ארוחות`, r.changes.insulinPerDay, C.accent],
  ];
  tiles.forEach((t, i) => kpiTile(pptx, s, 8.85 - (i % 3) * 4.1, 1.45 + Math.floor(i / 3) * 2.75, ...t));

  // זמן בטווח מול התקופה הקודמת
  s = frame(pptx, r, 'זמן בטווח – לעומת התקופה הקודמת', ++n, total);
  if (has) {
    const labels = [`התקופה הזו`, p.count ? 'התקופה הקודמת' : 'קודמת (אין נתונים)'];
    s.addChart(
      pptx.ChartType.bar,
      [
        { name: `מתחת ל-${st.low}`, labels, values: [k.lowPct || 0, p.lowPct || 0] },
        { name: `בטווח ${st.low}-${st.dayHigh}`, labels, values: [k.inRange || 0, p.inRange || 0] },
        { name: `מעל ${st.dayHigh}`, labels, values: [k.highPct || 0, p.highPct || 0] },
      ],
      { x: 0.6, y: 1.4, w: 12.1, h: 5.2, barDir: 'bar', barGrouping: 'percentStacked', chartColors: [C.low, C.ok, C.high], showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 14, showValue: true, dataLabelFontSize: 14, dataLabelColor: 'FFFFFF', dataLabelFormatCode: '0"%"', ...axis, valAxisLabelFormatCode: '0%', catAxisLabelFontSize: 16 },
    );
  } else empty(s);

  // מגמה
  s = frame(pptx, r, `הסוכר הממוצע ${unitName}`, ++n, total);
  const withMean = r.trend.filter((t) => t.mean !== '');
  if (withMean.length) {
    s.addChart(
      pptx.ChartType.line,
      [
        { name: 'ממוצע', labels: withMean.map((t) => t.label), values: withMean.map((t) => t.mean) },
        { name: `גבול עליון (${st.dayHigh})`, labels: withMean.map((t) => t.label), values: withMean.map(() => st.dayHigh) },
        { name: `גבול תחתון (${st.low})`, labels: withMean.map((t) => t.label), values: withMean.map(() => st.low) },
      ],
      { x: 0.6, y: 1.4, w: 12.1, h: 5.3, chartColors: [C.accent, C.high, C.low], lineSize: 3, lineDataSymbolSize: 7, showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 12, valAxisMinVal: 0, ...axis },
    );
  } else empty(s);

  // זמן בטווח לאורך התקופה
  s = frame(pptx, r, `זמן בטווח ${unitName}`, ++n, total);
  const withData = r.trend.filter((t) => t.count);
  if (withData.length) {
    const labels = withData.map((t) => t.label);
    s.addChart(
      pptx.ChartType.bar,
      [
        { name: 'נמוך', labels, values: withData.map((t) => t.low) },
        { name: 'בטווח', labels, values: withData.map((t) => t.ok) },
        { name: 'גבוה', labels, values: withData.map((t) => t.high) },
      ],
      { x: 0.6, y: 1.4, w: 12.1, h: 5.3, barDir: 'col', barGrouping: 'percentStacked', chartColors: [C.low, C.ok, C.high], showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 12, barGapWidthPct: 40, ...axis, valAxisLabelFormatCode: '0%' },
    );
  } else empty(s);

  // לפי שעות היום
  s = frame(pptx, r, 'לפי שעות היום', ++n, total);
  const parts = r.dayParts.filter((d) => d.count);
  if (parts.length) {
    s.addChart(pptx.ChartType.bar, [{ name: 'ממוצע', labels: parts.map((d) => d.label), values: parts.map((d) => d.mean) }], {
      x: 0.6, y: 1.4, w: 12.1, h: 5.3, barDir: 'col', chartColors: parts.map((d) => lvColor(d.mean, st)), showValue: true, dataLabelFontSize: 16, dataLabelFontBold: true, showLegend: false, valAxisMinVal: 0, ...axis, catAxisLabelFontSize: 14,
    });
  } else empty(s);

  // ארוחות – טבלה (העמודה הראשונה מימין)
  s = frame(pptx, r, 'ארוחות', ++n, total);
  if (r.meals.length) {
    const head = ['ארוחה', 'פעמים', 'מנות', 'אינסולין', 'לפני', 'שעתיים אחרי', 'בטווח', 'נפילות'];
    const cell = (text, extra = {}) => ({ text: String(text), options: { fontFace: FONT, fontSize: 14, align: 'center', valign: 'middle', color: C.ink, ...extra } });
    const rows = [
      head.map((h) => cell(h, { bold: true, color: 'FFFFFF', fill: { color: C.accent } })).reverse(),
      ...r.meals.map((m) =>
        [
          cell(m.name, { bold: true, align: 'right', rtlMode: true }),
          cell(m.count),
          cell(num(m.portion)),
          cell(num(m.dose), { bold: true }),
          cell(num(m.before), { color: m.before === '' ? C.muted : lvColor(m.before, { ...st, dayHigh: st.high }) }),
          cell(num(m.after2h), { color: m.after2h === '' ? C.muted : lvColor(m.after2h, st) }),
          cell(m.measured ? `${m.inRange}/${m.measured}` : '—'),
          cell(m.lows, { color: m.lows ? C.low : C.ink }),
        ].reverse(),
      ),
    ];
    s.addTable(rows, { x: 0.6, y: 1.45, w: 12.1, colW: [1.2, 1.3, 1.6, 1.4, 1.4, 1.2, 1.2, 2.8], rowH: 0.5, border: { type: 'solid', color: C.line, pt: 1 } });
  } else empty(s);

  // אינסולין
  s = frame(pptx, r, `אינסולין ממוצע ליום ${unitName}`, ++n, total);
  const ins = r.trend.filter((t) => t.insulin !== '');
  if (ins.length) {
    s.addChart(pptx.ChartType.bar, [{ name: 'יחידות ליום', labels: ins.map((t) => t.label), values: ins.map((t) => t.insulin) }], {
      x: 0.6, y: 1.4, w: 12.1, h: 5.3, barDir: 'col', chartColors: [C.accent], showValue: ins.length <= 20, dataLabelFontSize: 12, showLegend: false, valAxisMinVal: 0, ...axis,
    });
  } else empty(s);

  // מסקנות
  s = frame(pptx, r, 'מסקנות', ++n, total);
  if (r.findings.length) {
    const mark = { low: ['⚠️', C.low], high: ['📈', C.high], info: ['💡', C.accent], good: ['✅', C.ok] };
    r.findings.slice(0, 7).forEach((f, i) => {
      const y = 1.4 + i * 0.75;
      s.addShape(pptx.ShapeType.rect, { x: 12.55, y, w: 0.1, h: 0.62, fill: { color: mark[f.kind][1] }, line: { color: mark[f.kind][1] } });
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 11.95, h: 0.62, fill: { color: C.page }, line: { color: C.page } });
      s.addText(
        [
          { text: `${mark[f.kind][0]} ${f.text}`, options: { bold: true, fontSize: 15 } },
          ...(f.hint ? [{ text: `  ${f.hint}`, options: { fontSize: 12, color: C.muted } }] : []),
        ],
        T({ x: 0.75, y, w: 11.7, h: 0.62 }),
      );
    });
  } else s.addText('עוד אין מספיק נתונים למסקנות.', T({ x: 0.6, y: 3, w: 12.1, h: 1, fontSize: 22, color: C.muted, align: 'center' }));

  // סיכום AI
  if (ai) {
    s = frame(pptx, r, 'סיכום והמלצות (AI)', ++n, total);
    const lines = ai
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 16)
      .map((l) => {
        const h = /^#{1,4}\s+/.test(l);
        const li = /^(?:[-*•]|\d+[.)])\s+/.test(l);
        const text = l.replace(/^#{1,4}\s+/, '').replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
        return { text, options: { bold: h, fontSize: h ? 19 : 16, bullet: li ? { indent: 15 } : false, breakLine: true, paraSpaceAfter: 4 } };
      });
    s.addText(lines, T({ x: 0.6, y: 1.4, w: 12.1, h: 5.3, valign: 'top' }));
  }

  // סיום
  s = frame(pptx, r, 'לדיון עם הצוות הרפואי', ++n, total);
  s.addText(
    [
      { text: 'הדוח מסכם את מה שנרשם ביומן ואת נתוני החיישן שהועלו, כדי לראות דפוסים ולהביא שאלות לצוות.', options: { fontSize: 22, breakLine: true, paraSpaceAfter: 18 } },
      { text: 'הוא לא הוראה רפואית – כל שינוי במינונים רק בהתייעצות עם הצוות.', options: { fontSize: 22, bold: true, breakLine: true, paraSpaceAfter: 18 } },
      { text: `${r.sensorDays ? `${r.sensorDays} ימים בתקופה עם נתוני חיישן.` : 'בתקופה הזו אין נתוני חיישן – רק מדידות שהוקלדו.'} GMI הוא הערכה לפי הממוצע בלבד.`, options: { fontSize: 16, color: C.muted } },
    ],
    T({ x: 0.6, y: 1.8, w: 12.1, h: 4, valign: 'top' }),
  );
  return pptx;
}

export async function downloadDeck(r, ai, periodLabel) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = buildDeck(PptxGenJS, r, ai, periodLabel);
  await pptx.writeFile({ fileName: `yoman-sukar-report-${r.from}-${r.to}.pptx` });
}
