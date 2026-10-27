// בדיקות טהורות (בלי דפדפן) – כדי שאפשר יהיה לבדוק אותן

// הופך משפט לרשימת מילים קטנות בלי סימנים
function wordsOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// האם אחד מהדברים שהמיקרופון שמע הוא המילה (או משהו שנשמע כמעט אותו דבר)
export function saidWord(heard, word) {
  const ok = [word.en, ...(word.alt || [])].map((w) => w.toLowerCase());
  return heard.some((h) => {
    const text = wordsOf(h).join(' ');
    if (ok.includes(text)) return true;
    // מילה אחת מתוך משפט ("it is a cat"), או מילה כפולה ("grand ma")
    return ok.some((w) => (w.includes(' ') ? text.includes(w) : wordsOf(h).includes(w)));
  });
}

// 4 תשובות: התרגום הנכון ועוד 3 תרגומים אחרים מהרשימה, בסדר מעורבב
export function choicesFor(word, all, rand = Math.random) {
  const others = shuffle(all.filter((w) => w.he !== word.he), rand).slice(0, 3);
  return shuffle([word, ...others], rand).map((w) => w.he);
}

// במשפטים: התשובות השגויות דומות למשפט (אותה חיה, אותו צבע...) כדי שיצטרכו באמת להבין
const SMALL = new Set(['the', 'a', 'an', 'is', 'my', 'can', 'has']);
function common(a, b) {
  const wa = new Set(wordsOf(a).filter((w) => !SMALL.has(w)));
  return wordsOf(b).filter((w) => wa.has(w)).length;
}
export function sentenceChoicesFor(item, all, rand = Math.random) {
  const others = shuffle(all.filter((s) => s.he !== item.he), rand)
    .sort((x, y) => common(item.en, y.en) - common(item.en, x.en));
  const pick = [...others.slice(0, 2), ...shuffle(others.slice(2), rand).slice(0, 1)];
  return shuffle([item, ...pick], rand).map((s) => s.he);
}

// סיבוב עובר רק עם 80% תשובות נכונות לפחות
export const PASS = 80;
export function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}
export function passed(correct, total) {
  return total > 0 && correct * 100 >= PASS * total;
}

export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// סדר התרגול: קודם מילים שעוד לא נלמדו, ואחר כך כל השאר
export function nextOrder(all, learned, rand = Math.random) {
  const fresh = all.filter((w) => !learned[w.en]);
  const done = all.filter((w) => learned[w.en]);
  return [...shuffle(fresh, rand), ...shuffle(done, rand)];
}
