// מצב הדגמה: ילד שזז על מפה, כדי לראות את המפה החיה בדפדפן בלי טלפון אמיתי.
// פונקציות טהורות (נבדקות) – הזמן נכנס מבחוץ.

// מסלול סגור קטן (כיכר → בית ספר → פארק) באזור תל אביב. [lat, lng]
export const DEMO_PATH = [
  [32.0853, 34.7818],
  [32.0869, 34.7855],
  [32.0841, 34.7889],
  [32.0808, 34.7865],
  [32.0812, 34.7820],
  [32.0853, 34.7818],
];

// מקומות לדוגמה (גדרות וירטואליות)
export const DEMO_PLACES = [
  { id: 'school', name: 'בית ספר', lat: 32.0869, lng: 34.7855, radius: 160 },
  { id: 'home', name: 'בית', lat: 32.0853, lng: 34.7818, radius: 140 },
];

// מיקום הילד על המסלול בזמן t (ms). loopMs = כמה זמן לוקח סיבוב שלם.
export function demoPosition(t, loopMs = 60000, path = DEMO_PATH) {
  const segs = path.length - 1;
  const p = ((t % loopMs) / loopMs) * segs; // 0..segs
  const i = Math.floor(p);
  const f = p - i;
  const a = path[i];
  const b = path[i + 1] || path[i];
  return {
    lat: a[0] + (b[0] - a[0]) * f,
    lng: a[1] + (b[1] - a[1]) * f,
  };
}

// סוללה יורדת לאט ומתאפסת כל סיבוב (רק להמחשה)
export function demoBattery(t, loopMs = 60000) {
  return Math.round(95 - ((t % loopMs) / loopMs) * 40);
}
