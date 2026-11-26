// מפת הקומה במשרד התלת־ממדי (פונקציות טהורות, בלי three.js – נבדקות ב-layout.test.js).
// מסדרון לאורך ציר z באמצע; משרדים משמאל ומימין לו; משרד המנהל בסוף המסדרון.
// יחידות: מטרים. x ימינה, z לכיוון המצלמה (המסדרון מתחיל ב-z=0 ונמשך לשליליים).

export const ROOM = 4; // רוחב ועומק של משרד רגיל
export const HALL = 2.4; // רוחב המסדרון
export const GAP = 0.2; // עובי קיר בין משרדים
const STEP = ROOM + GAP;

// מיקום המשרד של כל בוט: { key, x, z, w, d, side, big }
//   side = -1 משמאל למסדרון, 1 מימין, 0 משרד המנהל בקצה. הדלת תמיד בצד שפונה למסדרון.
export function floorPlan(keys) {
  const manager = keys.includes('manager') ? 'manager' : null;
  const rest = keys.filter((k) => k !== manager);
  const perSide = Math.max(1, Math.ceil(rest.length / 2));
  const rooms = rest.map((key, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    return { key, side, big: false, w: ROOM, d: ROOM, x: side * (HALL / 2 + ROOM / 2), z: -row * STEP - ROOM / 2 };
  });
  const end = -perSide * STEP;
  if (manager) {
    const w = HALL + ROOM * 1.2;
    rooms.push({ key: manager, side: 0, big: true, w, d: ROOM + 0.6, x: 0, z: end - (ROOM + 0.6) / 2 });
  }
  const depth = -end + (manager ? ROOM + 0.6 : 0);
  return { rooms, width: HALL + ROOM * 2, depth, hallEnd: end };
}

// הנקודה במסדרון מול הדלת של משרד
export function doorPoint(room) {
  if (room.side === 0) return { x: 0, z: room.z + room.d / 2 + 0.5 };
  return { x: room.side * 0.45, z: room.z };
}

// הדלת עצמה (בקיר שפונה למסדרון)
export function doorway(room) {
  if (room.side === 0) return { x: 0, z: room.z + room.d / 2 };
  return { x: room.side * (HALL / 2), z: room.z };
}

// הכיסא: הבוט יושב ליד הקיר האחורי ופונה קדימה (לכיוון המצלמה – רואים את הפנים)
export function seat(room) {
  if (room.side === 0) return { x: 0, z: room.z - room.d / 2 + 1.1, face: 0 };
  return { x: room.x + room.side * 0.35, z: room.z - 0.85, face: 0 };
}

// השולחן מול הכיסא
export function desk(room) {
  if (room.side === 0) return { x: 0, z: room.z - room.d / 2 + 1.85, rot: 0, w: 2.2, d: 0.9 };
  return { x: room.x + room.side * 0.35, z: room.z - 0.12, rot: 0, w: 1.6, d: 0.8 };
}

// איפה עומד אורח (ליד השולחן, בצד המסדרון)
export function visitorSpot(room) {
  if (room.side === 0) return { x: 0.9, z: room.z - room.d / 2 + 2.75 };
  return { x: room.x - room.side * 0.45, z: room.z + 0.75 };
}

// ליד החלון (הקיר החיצוני) – לשם בוט פנוי הולך להסתכל על העיר
export function windowSpot(room) {
  if (room.side === 0) return { x: -1.6, z: room.z - room.d / 2 + 0.6 };
  return { x: room.x + room.side * 1.4, z: room.z + 0.9 };
}

// מסלול הליכה ממקום למקום: יוצאים מהמשרד דרך הדלת, הולכים במסדרון, נכנסים בדלת
export function pathBetween(fromRoom, toRoom, start, end) {
  const pts = [start];
  if (fromRoom !== toRoom) {
    const d1 = doorway(fromRoom);
    const d2 = doorway(toRoom);
    pts.push(d1, doorPoint(fromRoom), doorPoint(toRoom), d2);
  }
  pts.push(end);
  // בלי נקודות כפולות
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.01);
}

export const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.z - pts[i].z), 0);

// נקודה על המסלול לפי מרחק שעבר; מחזיר גם כיוון (זווית סביב y) לפנים
export function pointAt(pts, dist) {
  let left = Math.max(0, dist);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len || i === pts.length - 1) {
      const t = len ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, face: Math.atan2(b.x - a.x, b.z - a.z), done: i === pts.length - 1 && left >= len };
    }
    left -= len;
  }
  const p = pts[pts.length - 1];
  return { x: p.x, z: p.z, face: 0, done: true };
}
