// גודל בכיוון משמאל לימין (בתוך טקסט עברי "MB 391" היה מתהפך)
const ltr = (s) => `\u2066${s}\u2069`;

export function bytes(n) {
  return ltr(rawBytes(n));
}

function rawBytes(n) {
  if (!n) return '0';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function count(n) {
  return n.toLocaleString('he-IL');
}

export function date(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}
