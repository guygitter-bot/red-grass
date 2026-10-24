import { useEffect, useRef, useState } from 'react';

// במת התלת־ממד. onStage מקבל את ה-API של הבמה (או null ביציאה)
export default function GuitarStage({ type, teacher, onStage, onPick, hint = false, className = '', children }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const stageRef = useRef(null);
  const pickRef = useRef(onPick);
  const stageCb = useRef(onStage);
  const typeRef = useRef(type);
  const teacherRef = useRef(teacher);
  const [failed, setFailed] = useState(false);
  const [dragged, setDragged] = useState(false); // אחרי הגרירה הראשונה הרמז נעלם
  const [hasLabels, setHasLabels] = useState(false); // כשיש תוויות על הבמה הרמז לא מוצג (שלא יתנגש בהן)
  pickRef.current = onPick;
  stageCb.current = onStage;
  typeRef.current = type;
  teacherRef.current = teacher;

  // three.js נטען רק כשהבמה נפתחת (חבילה נפרדת – דף הבית והמכוון נטענים מהר יותר)
  useEffect(() => {
    let st = null;
    let gone = false;
    import('../three/stage')
      .then(({ createStage }) => {
        if (gone) return;
        try {
          st = createStage(canvasRef.current, labelsRef.current, {
            type: typeRef.current,
            teacher: teacherRef.current,
            onPick: (i) => {
              if (pickRef.current) pickRef.current(i);
            },
            onDrag: () => setDragged(true),
            onLabels: (n) => setHasLabels(n > 0),
          });
        } catch {
          setFailed(true);
          return;
        }
        stageRef.current = st;
        // לבדיקות בדפדפן (Playwright): מחשפים את הבמה רק כשהבדיקה ביקשה
        if (typeof window !== 'undefined' && window.__MT_DEBUG) window.__mtStage = st;
        if (stageCb.current) stageCb.current(st);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
      stageRef.current = null;
      if (st) {
        if (stageCb.current) stageCb.current(null);
        st.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (stageRef.current) stageRef.current.setGuitarType(type);
  }, [type]);

  useEffect(() => {
    if (stageRef.current) stageRef.current.setTeacher(teacher);
  }, [teacher]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-scene ${className}`}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="גיטרה בתלת־ממד" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {failed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-scene p-6 text-center text-ink">
          לא הצלחנו להציג את התלת־ממד במכשיר הזה. נסו לרענן את הדף או לפתוח בדפדפן אחר.
        </div>
      )}
      {hint && !dragged && !hasLabels && (
        <div className="pointer-events-none absolute bottom-2 start-3 end-3 text-center text-xs text-ink/80 [text-shadow:0_1px_2px_var(--color-scene)]">גררו עם האצבע כדי להסתכל מזווית אחרת</div>
      )}
      {children}
    </div>
  );
}
