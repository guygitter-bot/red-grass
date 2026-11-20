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

// מסמן אילו חלקים להכות עכשיו (now) ואילו בקרוב (soon). עובר על ה-DOM רק כשיש שינוי
export function setCues(root, now, soon) {
  if (!root) return;
  const key = [...now].sort().join(',') + '|' + [...soon].sort().join(',');
  if (root.dataset.cueKey === key) return;
  root.dataset.cueKey = key;
  root.querySelectorAll('[data-pad]').forEach((el) => {
    const id = el.dataset.pad;
    if (now.has(id)) el.dataset.cue = 'now';
    else if (soon.has(id)) el.dataset.cue = 'soon';
    else delete el.dataset.cue;
  });
  root.__fx?.cues(now, soon);
}

export function clearCues(root) {
  setCues(root, new Set(), new Set());
}
