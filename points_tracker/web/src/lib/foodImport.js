// קריאת רשימת מאכלים מקובץ: JSON ({ foods: [{ name, points }] } או מערך), או טקסט עם שורה לכל מאכל:
// "שם<TAB>ניקוד" או "שם,ניקוד" (הפסיק האחרון). מחזיר רק שורות תקינות, בלי כפילויות.
export function parseFoodList(text) {
  const raw = String(text || '').trim();
  let rows;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('הקובץ לא בפורמט JSON תקין.');
    }
    rows = (Array.isArray(data) ? data : data.foods || []).map((f) => [f?.name, f?.points]);
  } else {
    rows = raw.split(/\r?\n/).map((line) => {
      const i = line.includes('\t') ? line.lastIndexOf('\t') : line.lastIndexOf(',');
      return i > 0 ? [line.slice(0, i), line.slice(i + 1)] : [null, null];
    });
  }
  const seen = new Set();
  const foods = [];
  for (const [name, points] of rows) {
    const n = typeof name === 'string' ? name.trim() : '';
    const p = typeof points === 'number' ? points : parseFloat(String(points ?? '').trim());
    if (!n || n.length > 100 || !Number.isFinite(p) || p < 0 || p > 200) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    foods.push({ name: n, points: Math.round(p * 10) / 10 });
  }
  return foods;
}
