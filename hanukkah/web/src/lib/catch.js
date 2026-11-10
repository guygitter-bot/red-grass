// "תפוס את הסופגניות" – הלוגיקה בלי ציור (טהורה, כדי שאפשר לבדוק)
export const W = 360;
export const H = 520;
export const PLATE_W = 90;
export const PLATE_Y = H - 56; // גובה הצלחת
export const ITEM_R = 16;

export function newCatchGame() {
  return { plateX: W / 2, items: [], lives: 3, score: 0, spawnIn: 0.5, over: false, nextId: 1, events: [] };
}

// מהירות הנפילה עולה עם הניקוד
export function fallSpeed(score) {
  return 120 + Math.min(score, 80) * 3.2;
}
export function spawnGap(score) {
  return Math.max(0.38, 0.95 - score * 0.007);
}

function pickType(r) {
  if (r < 0.62) return 'sufganiya';
  if (r < 0.82) return 'coin';
  return 'drop';
}

/**
 * צעד אחד של המשחק. dir: -1 שמאלה, 1 ימינה, 0 עומד. rand: מחזיר מספר בין 0 ל-1.
 * state.events מכיל את מה שקרה בצעד הזה ('good' | 'bad' | 'over') בשביל הצלילים.
 */
export function step(state, dt, dir = 0, rand = Math.random) {
  if (state.over) return state;
  let { plateX, lives, score, spawnIn, nextId } = state;
  const events = [];
  plateX = Math.max(PLATE_W / 2, Math.min(W - PLATE_W / 2, plateX + dir * 360 * dt));

  const items = [];
  for (const it of state.items) {
    const y = it.y + fallSpeed(score) * it.speed * dt;
    // תפיסה: הפריט בגובה הצלחת ובתוך רוחבה
    if (y >= PLATE_Y - ITEM_R && y <= PLATE_Y + 18 && Math.abs(it.x - plateX) <= PLATE_W / 2 + ITEM_R * 0.6) {
      if (it.type === 'drop') {
        lives -= 1;
        events.push('bad');
      } else {
        score += it.type === 'coin' ? 2 : 1;
        events.push('good');
      }
      continue;
    }
    if (y > H + 30) continue; // יצא מהמסך
    items.push({ ...it, y });
  }

  spawnIn -= dt;
  if (spawnIn <= 0) {
    items.push({
      id: nextId++,
      x: ITEM_R + rand() * (W - ITEM_R * 2),
      y: -ITEM_R,
      type: pickType(rand()),
      speed: 0.85 + rand() * 0.3,
    });
    spawnIn = spawnGap(score);
  }

  const over = lives <= 0;
  if (over) events.push('over');
  return { ...state, plateX, items, lives: Math.max(0, lives), score, spawnIn, nextId, over, events };
}
