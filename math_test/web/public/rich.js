// הצגת טקסט שאלה: מספרים ותרגילים נשארים משמאל לימין (לא מתהפכים בתוך עברית), ו-3/4 מוצג כשבר עומד
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// שבר | רצף מספרים וסימני חשבון | אותיות לועזיות (A, AB) | ספרה בודדת
const TOKEN = /(\d+)\/(\d+)|[\d(□][\d\s+−\-×:=()□.,<>]*[\d)□]|[<>=]|[A-Za-z]+(?: ?[A-Za-z]+)*|\d/g;

export function rich(text) {
  const src = String(text ?? '');
  let out = '';
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    out += esc(src.slice(last, m.index));
    out += m[1] !== undefined
      ? `<span class="fr" dir="ltr"><i>${m[1]}</i><i>${m[2]}</i></span>`
      : `<bdi dir="ltr">${esc(m[0])}</bdi>`;
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}
