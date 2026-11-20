// אפקטים על החלקים בלי רינדור מחדש של React (מוסיפים מחלקות ו-data-attributes ישירות על האלמנטים).
// root = אלמנט הסט (kit-box); כל חלק הוא [data-pad="<מזהה>"].
// בבמה התלת־ממדית החלקים הם כפתורים נסתרים, ול-root יש __fx – אותם אפקטים עוברים גם אליו (הילה וטבעת על התוף עצמו).

// הבהוב קצר של חלק שהוכה (מוסיפים מחלקה ומאתחלים את האנימציה)
export function flashEl(el, cls = 'hit') {
  if (!el) return;
  el.classList.remove('hit', 'fb-perfect', 'fb-good', 'fb-miss');
  void el.offsetWidth;
  el.classList.add(cls);
  el.parentElement?.__fx?.flash(el.dataset.pad, cls);
}

export function padEl(root, id) {
  return root ? root.querySelector(`[data-pad="${id}"]`) : null;
}

// משוב על מכה של המשתמש: perfect / good / miss
export function feedbackPad(root, id, grade) {
  flashEl(padEl(root, id), `fb-${grade}`);
}

// מסמן אילו חלקים להכות עכשיו (now) ואילו בקרוב (soon). עובר על ה-DOM רק כשיש שינוי.
// hands (לא חובה) = { חלק: 'R' | 'L' } – באילו ידיים מנגנים (תרגילי טכניקה): data-hand על החלק וצבע הטבעת
export function setCues(root, now, soon, hands) {
  if (!root) return;
  const handKey = hands ? Object.entries(hands).sort().join(';') : '';
  const key = [...now].sort().join(',') + '|' + [...soon].sort().join(',') + '|' + handKey;
  if (root.dataset.cueKey === key) return;
  root.dataset.cueKey = key;
  root.querySelectorAll('[data-pad]').forEach((el) => {
    const id = el.dataset.pad;
    if (now.has(id)) el.dataset.cue = 'now';
    else if (soon.has(id)) el.dataset.cue = 'soon';
    else delete el.dataset.cue;
    if (hands && hands[id] && (now.has(id) || soon.has(id))) el.dataset.hand = hands[id];
    else delete el.dataset.hand;
  });
  root.__fx?.cues(now, soon, hands);
}

export function clearCues(root) {
  setCues(root, new Set(), new Set());
}
