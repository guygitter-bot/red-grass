// רשימת המורים – מקום אחד. מורה חדש = שורה חדשה כאן + קובץ GLB ב-public/teachers/.
// fit: התאמות לדמות (קנה מידה והזזת הגיטרה, ראו createModelTeacher). comingSoon: true = מוצג בבחירה אבל אי אפשר לבחור (אין עדיין קובץ GLB).
export const TEACHERS = [
  { id: 'male', label: 'גבר', file: 'teachers/male.glb' },
  { id: 'female', label: 'אישה', file: 'teachers/female.glb', fit: { scale: 1.12, dx: -3, dz: -3, shrug: 0.7 } },
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
