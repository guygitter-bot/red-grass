// משחק הדלקת החנוכייה (פונקציות טהורות).
// נרות ממוספרים 1-8 מימין לשמאל. מניחים נרות מימין; מדליקים קודם את השמש,
// ואחר כך את הנר החדש ביותר (השמאלי, מספר הלילה) וממשיכים ימינה.
export function newCandleGame(night) {
  return {
    night,
    placed: Array(8).fill(false),
    shamashPlaced: false,
    lit: Array(8).fill(false),
    shamashLit: false,
    phase: 'place', // place | light | done
    mistakes: 0,
  };
}

const ok = (msg) => ({ ok: true, msg });
const bad = (msg) => ({ ok: false, msg });

function readyToLight(s) {
  for (let i = 0; i < s.night; i++) if (!s.placed[i]) return false;
  return s.shamashPlaced;
}

// הנחת (או הסרת) נר k (1-8)
export function placeCandle(s, k) {
  if (s.phase !== 'place') return { state: s, feedback: ok('') };
  if (k > s.night) {
    return {
      state: { ...s, mistakes: s.mistakes + 1 },
      feedback: bad(
        s.night === 1
          ? 'בלילה הראשון מניחים רק נר אחד, בצד הימני.'
          : `בלילה הזה צריך ${s.night} נרות בלבד. מניחים אותם מהצד הימני.`,
      ),
    };
  }
  const placed = s.placed.slice();
  placed[k - 1] = !placed[k - 1];
  let next = { ...s, placed };
  let msg = placed[k - 1] ? 'יפה!' : 'הנר הוסר.';
  if (readyToLight(next)) {
    next = { ...next, phase: 'light' };
    msg = 'מעולה! עכשיו מדליקים: קודם את השמש.';
  }
  return { state: next, feedback: ok(msg) };
}

export function placeShamash(s) {
  if (s.phase !== 'place') return { state: s, feedback: ok('') };
  let next = { ...s, shamashPlaced: !s.shamashPlaced };
  let msg = next.shamashPlaced ? 'השמש במקומו, באמצע.' : 'השמש הוסר.';
  if (readyToLight(next)) {
    next = { ...next, phase: 'light' };
    msg = 'מעולה! עכשיו מדליקים: קודם את השמש.';
  }
  return { state: next, feedback: ok(msg) };
}

// מה הצעד הבא בהדלקה: 'shamash' או מספר נר
export function nextToLight(s) {
  if (!s.shamashLit) return 'shamash';
  for (let k = s.night; k >= 1; k--) if (!s.lit[k - 1]) return k;
  return null;
}

// הדלקה: target הוא 'shamash' או מספר נר
export function lightTap(s, target) {
  if (s.phase !== 'light') return { state: s, feedback: ok('') };
  const expected = nextToLight(s);
  if (target === 'shamash' && s.shamashLit) return { state: s, feedback: ok('השמש כבר דולק.') };
  if (target !== 'shamash' && s.lit[target - 1]) return { state: s, feedback: ok('הנר הזה כבר דולק.') };
  if (target !== 'shamash' && target > s.night) {
    return { state: s, feedback: ok('שם אין נר. הדליקו את הנרות שהצבתם.') };
  }
  if (target !== expected) {
    let msg;
    if (expected === 'shamash') msg = 'קודם מדליקים את השמש, ומהשמש מדליקים את כל השאר.';
    else if (target === 'shamash') msg = 'השמש כבר דלק.';
    else msg = 'מתחילים מהנר החדש ביותר, זה השמאלי, ואחר כך ממשיכים ימינה.';
    return { state: { ...s, mistakes: s.mistakes + 1 }, feedback: bad(msg) };
  }
  let next;
  if (target === 'shamash') {
    next = { ...s, shamashLit: true };
  } else {
    const lit = s.lit.slice();
    lit[target - 1] = true;
    next = { ...s, lit };
  }
  if (nextToLight(next) === null) {
    return {
      state: { ...next, phase: 'done' },
      feedback: ok(next.mistakes === 0 ? 'כל הכבוד! הדלקתם נכון, בלי טעויות!' : 'כל הכבוד! החנוכייה דולקת!'),
    };
  }
  return { state: next, feedback: ok(target === 'shamash' ? 'עכשיו הנר החדש, השמאלי.' : 'יפה, ממשיכים ימינה.') };
}

// מצב התצוגה לכל נר: none | placed | lit
export function candleView(s) {
  return {
    candles: s.placed.map((p, i) => (s.lit[i] ? 'lit' : p ? 'placed' : 'none')),
    shamash: s.shamashLit ? 'lit' : s.shamashPlaced ? 'placed' : 'none',
  };
}
