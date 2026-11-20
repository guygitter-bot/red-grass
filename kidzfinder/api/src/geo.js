// חישובי מיקום וגדרות וירטואליות (geofence) – פונקציות טהורות, בלי תלות בשרת.

// מרחק בין שתי נקודות בכדור הארץ, במטרים (נוסחת haversine).
export function distanceMeters(a, b) {
  const R = 6371000; // רדיוס כדור הארץ במטרים
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// רשימת המזהים של המקומות (places) שהנקודה נמצאת בתוכם (בתוך הרדיוס).
// place = { id, name, lat, lng, radius } (radius במטרים).
export function placesContaining(point, places) {
  if (!point || !Array.isArray(places)) return [];
  return places
    .filter((p) => distanceMeters(point, p) <= (p.radius || 100))
    .map((p) => p.id);
}

// השוואה בין המקומות שהילד היה בהם קודם לבין עכשיו → אירועי הגעה/יציאה.
// מחזיר מערך של { type: 'enter' | 'exit', placeId }.
export function geofenceEvents(prevIds, nowIds) {
  const prev = new Set(prevIds || []);
  const now = new Set(nowIds || []);
  const events = [];
  for (const id of now) if (!prev.has(id)) events.push({ type: 'enter', placeId: id });
  for (const id of prev) if (!now.has(id)) events.push({ type: 'exit', placeId: id });
  return events;
}

// האם לשלוח התראת סוללה חלשה: רק כשהסוללה יורדת מתחת לסף ולא היתה מתחתיו קודם
// (כדי לא לשלוח התראה בכל עדכון). threshold = אחוז (ברירת מחדל 15).
export function lowBatteryCrossed(prevBattery, nowBattery, threshold = 15) {
  if (typeof nowBattery !== 'number') return false;
  const wasAbove = typeof prevBattery !== 'number' || prevBattery > threshold;
  return wasAbove && nowBattery <= threshold;
}

// האם מיקום "טרי" (עודכן לאחרונה) או שהילד לא מעדכן כבר הרבה זמן.
// מחזיר true אם עברו יותר מ-staleMs מאז העדכון האחרון.
export function isStale(lastTs, now, staleMs = 10 * 60 * 1000) {
  if (!lastTs) return true;
  return now - lastTs > staleMs;
}
