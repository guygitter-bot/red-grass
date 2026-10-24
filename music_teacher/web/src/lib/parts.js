// חלקי הגיטרה ומצלמות – נתונים בלבד (בלי תלת־ממד), כדי שאפשר יהיה לבדוק התאמה לשיעורים
export const GUITAR_NAMES = { classical: 'גיטרה קלאסית', electric: 'גיטרה חשמלית' };

export const PART_NAMES = {
  classical: {
    head: 'ראש הגיטרה',
    pegs: 'מפתחות הכיוון',
    nut: 'האום',
    fretboard: 'לוח האצבעות',
    frets: 'שריגים',
    dots: 'נקודות סימון',
    body: 'תיבת התהודה',
    soundhole: 'חור הקול',
    bridge: 'הגשר',
    strings: 'המיתרים',
  },
  electric: {
    head: 'ראש הגיטרה',
    pegs: 'מפתחות הכיוון',
    nut: 'האום',
    fretboard: 'לוח האצבעות',
    frets: 'שריגים',
    dots: 'נקודות סימון',
    body: 'גוף מלא',
    pickups: 'פיקאפים',
    knobs: 'כפתורי עוצמה וטון',
    jack: 'שקע לכבל',
    bridge: 'גשר',
    strings: 'המיתרים',
  },
};

// מצלמה: part = החלק שמסתכלים עליו (null = כל הסצנה), dist = מרחק, az/el = זווית במעלות
export const PRESETS = {
  classical: {
    wide: { part: null, dist: 178, az: 6, el: 5, fit: 0.8 },
    head: { part: 'head', dist: 26, az: 12, el: 14 },
    nut: { part: 'nut', dist: 21, az: 10, el: 16 },
    fretboard: { part: 'fretboard', dist: 34, az: 4, el: 12 },
    body: { part: 'body', dist: 46, az: -6, el: 14 },
    bridge: { part: 'bridge', dist: 25, az: -10, el: 22 },
    strings: { part: 'strings', dist: 74, az: 3, el: 10 },
    leftHand: { part: 'fretboard', x: 4.5, dist: 30, az: 0, el: 14 },
    // תקריב אקורד: מבט מלמעלה על פני הלוח (phi = הטיה מהניצב ללוח, psi = הטיה לכיוון האום), שריגים 0 עד frets
    chord: { board: true, frets: 4, phi: 32, psi: 8 },
    rightHand: { part: 'bridge', dist: 32, az: -26, el: 18 },
    hands: { part: 'strings', dist: 62, az: 0, el: 8 },
  },
  electric: {
    wide: { part: null, dist: 178, az: 6, el: 5, fit: 0.8 },
    head: { part: 'head', dist: 26, az: 12, el: 14 },
    nut: { part: 'nut', dist: 21, az: 10, el: 16 },
    fretboard: { part: 'fretboard', dist: 34, az: 4, el: 12 },
    body: { part: 'body', dist: 46, az: -6, el: 14 },
    bridge: { part: 'bridge', dist: 25, az: -10, el: 22 },
    strings: { part: 'strings', dist: 74, az: 3, el: 10 },
    leftHand: { part: 'fretboard', x: 4.5, dist: 30, az: 0, el: 14 },
    // תקריב אקורד: מבט מלמעלה על פני הלוח (phi = הטיה מהניצב ללוח, psi = הטיה לכיוון האום), שריגים 0 עד frets
    chord: { board: true, frets: 4, phi: 32, psi: 8 },
    rightHand: { part: 'bridge', dist: 32, az: -26, el: 18 },
    hands: { part: 'strings', dist: 62, az: 0, el: 8 },
  },
};
