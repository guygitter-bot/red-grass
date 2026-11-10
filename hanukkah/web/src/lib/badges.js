import { safeProgress, totalStars, STORY_CHAPTERS } from './progress';

// תגים: כל תג נקבע מההתקדמות בלבד
export const BADGES = [
  { id: 'story', icon: '📖', name: 'מכירים את הסיפור', desc: 'סיימתם את כל פרקי הסיפור', test: (p) => p.story.length >= STORY_CHAPTERS },
  { id: 'quiz1', icon: '🎓', name: 'חכמים', desc: 'סיימתם סיבוב חידון בכל רמה', test: (p) => ['easy', 'medium', 'hard'].every((l) => p.quiz[l].rounds > 0) },
  { id: 'champ', icon: '🏆', name: 'אלוף החידון', desc: 'ענו נכון על 7 שאלות או יותר ברמת אלוף', test: (p) => p.quiz.hard.best >= 7 },
  { id: 'perfect', icon: '💯', name: 'בלי טעויות', desc: 'סיבוב חידון עם 8 מתוך 8', test: (p) => ['easy', 'medium', 'hard'].some((l) => p.quiz[l].best >= 8) },
  { id: 'nights', icon: '🕎', name: 'מדליקים כמו גדולים', desc: 'הדלקתם נכון את כל 8 הלילות', test: (p) => p.candles.length >= 8 },
  { id: 'candle1', icon: '🕯️', name: 'נר ראשון', desc: 'הדלקתם חנוכייה נכון, בלי טעויות', test: (p) => p.candles.length >= 1 },
  { id: 'dreidel', icon: '🌀', name: 'מלך הסביבון', desc: 'ניצחתם את המחשב בסביבון', test: (p) => p.dreidel.wins >= 1 },
  { id: 'memory', icon: '🧠', name: 'זיכרון של פיל', desc: 'סיימתם את משחק הזיכרון בגודל גדול', test: (p) => p.memory.large > 0 },
  { id: 'catch', icon: '🍩', name: 'תופסי הסופגניות', desc: 'הגעתם ל-15 נקודות במשחק התפיסה', test: (p) => p.catchBest >= 15 },
  { id: 'words', icon: '🔤', name: 'פותרי מילים', desc: 'פתרתם 10 מילים מבולבלות', test: (p) => p.scramble.length >= 10 },
  { id: 'facts', icon: '💡', name: 'יודעי דבר', desc: 'קראתם 10 עובדות "הידעת?"', test: (p) => p.facts.length >= 10 },
  { id: 'riddles', icon: '🧩', name: 'פותרי חידות', desc: 'גיליתם 8 תשובות לחידות', test: (p) => p.riddles.length >= 8 },
  { id: 'card', icon: '💌', name: 'כרטיס ברכה', desc: 'יצרתם כרטיס ברכה', test: (p) => p.cards >= 1 },
  { id: 'stars', icon: '⭐', name: 'אוסף כוכבים', desc: 'אספתם 20 כוכבים', test: (p) => totalStars(p) >= 20 },
];

export function earnedBadges(progress) {
  const p = safeProgress(progress);
  return BADGES.filter((b) => b.test(p)).map((b) => b.id);
}
