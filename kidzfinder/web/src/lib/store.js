// שמירת זהות ההורה במכשיר (מזהה המשפחה + הטוקן). בלי זה אי אפשר לקרוא את המצב.
const KEY = 'kf_parent';

export function loadParent() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveParent(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
export function clearParent() {
  try { localStorage.removeItem(KEY); } catch {}
}
