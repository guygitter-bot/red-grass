// פריסת תוויות על הבמה (פונקציה טהורה, כדי שאפשר לבדוק בלי דפדפן).
// items: [{ cx, cy, w, h }] = מרכז ומידות כל תווית בפיקסלים. משנה את cx/cy במקום:
// התוויות נשארות בתוך המסגרת (W x H) ולא חופפות אחת לשנייה (ריחוק אנכי, ואם אין ברירה גם אופקי).
export function layoutLabels(items, W, H, margin = 6, gapX = 4, gapY = 3) {
  const clamp = (o) => {
    o.cx = Math.min(Math.max(o.cx, o.w / 2 + margin), Math.max(W - o.w / 2 - margin, o.w / 2 + margin));
    o.cy = Math.min(Math.max(o.cy, o.h / 2 + margin), Math.max(H - o.h / 2 - margin, o.h / 2 + margin));
  };
  items.forEach(clamp);
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const ox = (a.w + b.w) / 2 + gapX - Math.abs(a.cx - b.cx);
        const oy = (a.h + b.h) / 2 + gapY - Math.abs(a.cy - b.cy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const up = a.cy <= b.cy ? a : b;
        const dn = up === a ? b : a;
        // קודם אנכית: העליונה למעלה והתחתונה למטה
        up.cy -= oy / 2;
        dn.cy += oy / 2;
        clamp(up);
        clamp(dn);
        // אם אחת נתקעה בקצה והחפיפה נשארה – מזיזים אופקית את זו שיש לה מקום
        const left = a.cx <= b.cx ? a : b;
        const right = left === a ? b : a;
        const still = (a.h + b.h) / 2 + gapY - Math.abs(a.cy - b.cy);
        if (still > 0) {
          left.cx -= ox / 2;
          right.cx += ox / 2;
          clamp(left);
          clamp(right);
        }
      }
    }
    if (!moved) break;
  }
  return items;
}
