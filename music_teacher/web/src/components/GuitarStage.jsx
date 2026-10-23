import { useEffect, useRef, useState } from 'react';

// במת התלת־ממד. onStage מקבל את ה-API של הבמה (או null ביציאה)
export default function GuitarStage({ type, teacher, onStage, onPick, className = '', children }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const stageRef = useRef(null);
  const pickRef = useRef(onPick);
  const stageCb = useRef(onStage);
  const typeRef = useRef(type);
  const teacherRef = useRef(teacher);
  const [failed, setFailed] = useState(false);
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
          });
        } catch {
          setFailed(true);
          return;
        }
        stageRef.current = st;
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
      {children}
    </div>
  );
}
