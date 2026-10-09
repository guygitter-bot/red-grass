import { LessonForm, LessonView } from './Lesson';
import { StudentForm, StudentView } from './Students';
import { TeacherForm, TeacherView } from './Teachers';
import { PaymentForm } from './Payments';
import { whatsapp } from '../lib/schedule';

// החלונות הפתוחים (אחד מעל השני: שיעור ← מורה ← ...). כולם נשארים חיים כדי שטופס לא יאבד את מה שהוקלד,
// אבל רואים רק את העליון
const VIEWS = {
  lesson: LessonView,
  lessonForm: LessonForm,
  student: StudentView,
  studentForm: StudentForm,
  teacher: TeacherView,
  teacherForm: TeacherForm,
  payment: PaymentForm,
};

export default function Panels({ app, stack }) {
  return stack.map((panel, i) => {
    const View = VIEWS[panel.type];
    const top = i === stack.length - 1;
    return (
      <div key={i} hidden={!top}>
        <View app={app} panel={panel} onBack={i > 0 ? app.back : null} />
      </div>
    );
  });
}

// פעולה בשרת עם הודעה. אם השינוי נשלח כבקשה למורה אחר – מציעים לשלוח לו גם וואטסאפ
export async function run(app, path, body, okText) {
  try {
    const res = await app.act(path, body);
    if (res.request) {
      // אל מי הבקשה (כמו בשרת): המורה של השיעור, ואם השיעור שלי – המורה החדש שבחרתי
      const lesson = app.lessons.find((l) => l.id === (body.lessonId || body.id || body.item?.id));
      const to = app.teacherMap[lesson && lesson.teacherId !== app.me.id ? lesson.teacherId : body.item?.teacherId];
      const phone = to?.phone;
      app.toast(`הבקשה נשלחה ל${to?.first || 'מורה'} לאישור`, {
        ms: 9000,
        action: phone
          ? { label: 'גם בוואטסאפ', href: whatsapp(phone, `היי ${to.first}, שלחתי לך בקשה לשינוי שיעור במערכת של רוק סיטי. אפשר לאשר שם 🙏 ${location.origin}${location.pathname}`) }
          : null,
      });
    } else if (okText) app.toast(okText);
    return res;
  } catch (e) {
    app.toast(`⚠️ ${e.message}`, { ms: 6000 });
    return null;
  }
}

