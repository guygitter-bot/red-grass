// רשימת המורים – מקום אחד. מורה חדש = שורה חדשה כאן + קובץ GLB ב-public/teachers/.
// fit: התאמות לדמות (קנה מידה והזזת הגיטרה, וגובה/מרחק פרקי האצבעות בקשת: knuckleH / knuckleBack, ראו createModelTeacher). comingSoon: true = מוצג בבחירה אבל אי אפשר לבחור (אין עדיין קובץ GLB).
export const TEACHERS = [
  {
    id: 'male', label: 'גבר', file: 'teachers/male.glb',
    // fit.classical / fit.electric: הזזת הגיטרה (dx/dy/dz), הטיה (tilt) וסיבוב (yaw) לכל סוג – כוונו לפי בדיקת חדירה מול העור
    fit: {
      shrug: 0.1,
      classical: { dx: -2, dy: 7.5, dz: 3.2, tilt: 0.1, yaw: 0.17 },
      electric: { dx: 0, dy: 5.5, dz: 2.6, tilt: 0.07, yaw: 0 },
    },
  },
  {
    id: 'female', label: 'אישה', file: 'teachers/female.glb',
    fit: {
      scale: 1.12, shrug: 0.7,
      knuckleH: 2.0, knuckleBack: 3.4, // קשת האצבעות: זרועות ואצבעות קצרות יותר – פרקים נמוכים וקרובים יותר
      classical: { dx: -0.3, dy: 8, dz: 5.3, tilt: -0.01, yaw: 0 },
      electric: { dx: 0, dy: 5.9, dz: 5.3, tilt: 0.05, yaw: 0 },
    },
  },
];
export const DEFAULT_TEACHER = 'male';

// מורה לפי מזהה; מזהה לא מוכר או "בקרוב" -> ברירת המחדל
export function teacherById(id) {
  const t = TEACHERS.find((x) => x.id === id);
  return t && !t.comingSoon ? t : TEACHERS.find((x) => x.id === DEFAULT_TEACHER);
}
// כתובת הקובץ (יחסית לדף, כמו שאר הנכסים)
export function teacherUrl(t) {
  return `${import.meta.env.BASE_URL}${t.file}`;
}
