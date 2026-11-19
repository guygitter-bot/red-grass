// מחולל מספרים אקראיים עם זרע (seed): אותו זרע = אותן שאלות. כך אפשר להמשיך סיבוב שנשמר בלי לשמור את כל השאלות
export function makeRng(seed = Date.now()) {
  let s = (Number(seed) >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // מספר שלם בין a ל-b (כולל)
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const chance = (p = 0.5) => next() < p;
  return { next, int, pick, shuffle, chance };
}
