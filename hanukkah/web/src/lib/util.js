// ערבוב פישר-ייטס; rand ניתן להחלפה בבדיקות
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(arr, n, rand = Math.random) {
  return shuffle(arr, rand).slice(0, n);
}
