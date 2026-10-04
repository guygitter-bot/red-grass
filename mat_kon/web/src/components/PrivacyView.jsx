import { ArrowRight } from 'lucide-react';

// פרטיות ותנאי שימוש – תקציר פשוט. לפני השקה מסחרית יש לעבור עליו עם עורך דין.
export default function PrivacyView({ onBack }) {
  const H = ({ children }) => <h2 className="font-bold text-lg mt-6 mb-2">{children}</h2>;
  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">פרטיות ותנאי שימוש</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 text-stone-700 leading-relaxed">
        <H>מה נשמר</H>
        <ul className="list-disc pr-5 space-y-1">
          <li>פרטי החשבון: שם ואימייל (וסיסמה מוצפנת, אם נרשמתם עם סיסמה).</li>
          <li>התוכן שלכם: מתכונים, תמונות שהעליתם, הערות, דירוגים, רשימת קניות, תכנון שבועי ומה יש במקרר ובמזווה.</li>
          <li>בספר משותף – כל החברים בספר רואים ועורכים את התוכן הזה.</li>
        </ul>

        <H>שירותים חיצוניים</H>
        <ul className="list-disc pr-5 space-y-1">
          <li>כדי לסדר מתכון, קישורים, טקסטים ותמונות שאתם שולחים מועברים לעיבוד בשירות AI (Anthropic). הם לא משמשים לאימון.</li>
          <li>כניסה עם גוגל: מקבלים מגוגל רק את השם והאימייל.</li>
          <li>"איפה לקנות": המיקום נשאל רק כשלוחצים, נשלח בקירוב לשירותי מפות ומחירים כדי למצוא סופרים קרובים, ולא נשמר.</li>
        </ul>

        <H>מה לא עושים</H>
        <ul className="list-disc pr-5 space-y-1">
          <li>לא מוכרים מידע ולא מציגים פרסומות.</li>
          <li>לא ניגשים לחשבונות שלכם ברשתות חברתיות – קוראים רק קישורים ציבוריים שאתם משתפים.</li>
        </ul>

        <H>שליטה במידע</H>
        <ul className="list-disc pr-5 space-y-1">
          <li>אפשר להוריד גיבוי מלא בכל רגע (הגדרות ← גיבוי).</li>
          <li>אפשר לצאת מכל המכשירים ולמחוק את החשבון לצמיתות (הגדרות ← החשבון).</li>
        </ul>

        <H>תנאי שימוש בקצרה</H>
        <ul className="list-disc pr-5 space-y-1">
          <li>המתכונים מסודרים אוטומטית ועלולים לכלול טעויות – כדאי לבדוק כמויות, אלרגנים וזמני בישול.</li>
          <li>משתמשים באפליקציה לשימוש אישי ומשפחתי, ושומרים רק תוכן שמותר לכם לשמור.</li>
          <li>לשימוש החינמי ולמנוי יש מכסה הוגנת של פעולות חכמות ביום.</li>
        </ul>
        <p className="text-sm text-stone-500 mt-6">עודכן: אוקטובר 2026</p>
      </div>
    </div>
  );
}
