// תרגילי טכניקה ("רודימנטס") על מנוע הלימוד. כל תרגיל = סעיף אחד על רשת של 16 צעדים לתיבה (12 לשלישיות), עם קצב התחלה וקצב יעד.
// לכל חלק מחרוזת: R / L = מכה ביד ימין / שמאל, r / l = אותה מכה בשקט (נגיעה), x = מכה בלי יד (רגל), נקודה = שקט. רווחים מתעלמים.
// הפלט תואם את הסעיפים של data/grooves.js ({ id, name, steps, bars, hits }) + hands (ידיים) ו-soft (שקט) לכל חלק.

function build(ex) {
  const hits = {};
  const hands = {};
  const soft = {};
  for (const [piece, str] of Object.entries(ex.pattern)) {
    const s = str.replace(/\s/g, '');
    const len = ex.steps * ex.bars;
    if (s.length !== len) throw new Error(`rudiments: אורך ${s.length} במקום ${len} ב-${ex.id}/${piece}`);
    hits[piece] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '.') continue;
      hits[piece].push(i);
      if (c === 'R' || c === 'L' || c === 'r' || c === 'l') {
        (hands[piece] ||= {})[i] = c.toUpperCase();
        if (c === 'r' || c === 'l') (soft[piece] ||= []).push(i);
      }
    }
  }
  const { pattern, ...rest } = ex;
  return { ...rest, section: { id: ex.id, name: ex.name, steps: ex.steps, bars: ex.bars, hits, hands, soft } };
}

const ex = (id, cat, name, desc, bpm, target, steps, pattern, bars = 1) =>
  build({ id, cat, name, desc, bpm, target, steps, bars, pattern });

export const CATEGORIES = [
  { id: 'basic', name: 'יסודות הידיים' },
  { id: 'coord', name: 'תיאום' },
  { id: 'fills', name: 'שלישיות ומילויים' },
];

// הסדר = מסלול הלמידה (ההצעה הבאה לוקחת לפי הסדר הזה)
export const EXERCISES = [
  ex('single8', 'basic', 'מכות בודדות', 'ימין, שמאל, ימין, שמאל – בשמיניות, על הסנר. שניהם באותה עוצמה ובלי למהר.', 60, 120, 16, {
    snare: 'R.L. R.L. R.L. R.L.',
  }),
  ex('single16', 'basic', 'מכות בודדות מהירות', 'אותו דבר בשש-עשרה: ארבע מכות לכל פעמה. תנו למקל לקפוץ.', 50, 100, 16, {
    snare: 'RLRL RLRL RLRL RLRL',
  }),
  ex('double', 'basic', 'מכות כפולות', 'כל יד מכה פעמיים: ימין-ימין, שמאל-שמאל. המכה השנייה נשמעת בדיוק כמו הראשונה.', 50, 90, 16, {
    snare: 'RRLL RRLL RRLL RRLL',
  }),
  ex('paradiddle', 'basic', 'פרדידל', 'ימין-שמאל-ימין-ימין, ואז שמאל-ימין-שמאל-שמאל. היד שמתחילה מתחלפת.', 50, 100, 16, {
    snare: 'RLRR LRLL RLRR LRLL',
  }),
  ex('dparadiddle', 'basic', 'פרדידל כפול', 'שש מכות: ימין-שמאל-ימין-שמאל-ימין-ימין, ואז הפוך. שלישיות – שתי קבוצות בתיבה.', 50, 90, 12, {
    snare: 'RLRLRR LRLRLL',
  }),
  ex('flam', 'basic', 'פלאם (בקירוב)', 'מכה קטנה לפני המכה העיקרית ביד השנייה. כאן הקישוט הוא מכה נפרדת, צעד אחד לפני העיקרית.', 50, 90, 16, {
    snare: 'R..R L..L R..R L..L',
  }),
  ex('accents', 'basic', 'הדגשות', 'מכה אחת חזקה ושתיים חלשות (אות קטנה = חלש). שומרים על הפרש ברור בין חזק לחלש.', 55, 100, 12, {
    snare: 'Rll Lrr Rll Lrr',
  }),
  ex('hat8', 'coord', 'היי-האט שמיניות', 'יד ימין על ההיי-האט בשמיניות, שמאל על הסנר בפעמות 2 ו-4, הבס בפעמות 1 ו-3. הידיים לא צריכות להישמע מהודקות.', 60, 110, 16, {
    hihat: 'R.R. R.R. R.R. R.R.',
    snare: '.... L... .... L...',
    kick: 'x... .... x... ....',
  }),
  ex('hat16', 'coord', 'היי-האט שש-עשרה', 'שתי הידיים מתחלפות על ההיי-האט; הבס והסנר נשארים במקום. החזקים בפעמות, החלשים ביניהן.', 50, 90, 16, {
    hihat: 'RlRl RlRl RlRl RlRl',
    snare: '.... L... .... L...',
    kick: 'x... .... x... ....',
  }),
  ex('kicksnare', 'coord', 'בס וסנר', 'תיאום יד ורגל: הבס נכנס גם בין הפעמות והסנר נשאר בפעמות 2 ו-4.', 60, 110, 16, {
    kick: 'x... ..x. x.x. ....',
    snare: '.... R... .... R...',
    hihat: 'L.L. L.L. L.L. L.L.',
  }),
  ex('triplets', 'fills', 'שלישיות', 'שלוש מכות לכל פעמה, וכל פעם מתחילה יד אחרת: ימין-שמאל-ימין, שמאל-ימין-שמאל.', 50, 100, 12, {
    snare: 'RLR LRL RLR LRL',
  }),
  ex('fill', 'fills', 'מילוי בסיסי על הטומים', 'סנר, ואז טום 1, טום 2 והרצפה – יורדים בהדרגה, והבס סוגר. כל פעמה = מכה אחרת.', 50, 100, 16, {
    snare: 'RLRL .... .... ....',
    tom1: '.... RLRL .... ....',
    tom2: '.... .... RLRL ....',
    floor1: '.... .... .... RLR.',
    kick: '.... .... .... ...x',
  }),
];

export function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id) || null;
}
export const exerciseKey = (id) => `ex:${id}`;
