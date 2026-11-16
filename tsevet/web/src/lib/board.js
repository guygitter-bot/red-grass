// מיקום הבוטים על מעגל (באחוזים מתוך הלוח): הראשון למעלה, ואז עם כיוון השעון.
// עם 3 בוטים יוצא משולש, ועם עד ~10 – מעגל מלא
export function circlePositions(n, radius = 36) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-Math.PI / 2) + (2 * Math.PI * i) / Math.max(n, 1);
    return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
  });
}

// כל זוג בוטים מחובר בקו דק
export function pairs(n) {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

// גודל העיגול באחוזים – קטן יותר כשיש יותר בוטים
export function avatarSize(n) {
  if (n <= 4) return 24;
  if (n <= 6) return 20;
  if (n <= 8) return 16;
  return 13;
}
