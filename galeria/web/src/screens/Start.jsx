import { isNative } from '../lib/source.js';

export default function Start({ denied, onStart }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 pt-[calc(1.5rem+var(--safe-top))]">
      <div className="max-w-md w-full bg-card border border-line rounded-3xl p-6 text-center flex flex-col gap-4 shadow-sm">
        <img src="icon.svg" alt="" className="w-20 h-20 mx-auto" />
        <h1 className="text-2xl font-bold">גלריה מסודרת</h1>
        <p className="text-muted leading-relaxed">
          האפליקציה עוברת על כל התמונות בגלריה, ממיינת אותן לנושאים, מוצאת תמונות כפולות, דומות, מטושטשות וצילומי מסך ישנים –
          ועוזרת לפנות מקום.
        </p>
        <ul className="text-sm text-right flex flex-col gap-2 bg-soft rounded-2xl p-4">
          <li>🔒 התמונות לא יוצאות מהטלפון – הכול נעשה בתוכו, בלי אינטרנט.</li>
          <li>✋ שום דבר לא נמחק לבד: רק מה שמסמנים, ואנדרואיד שואל לפני.</li>
          <li>♻️ מה שנמחק עובר לפח של הגלריה – אפשר לשחזר במשך 30 יום.</li>
        </ul>
        {denied && (
          <p className="text-bad text-sm">
            בלי הרשאה לתמונות אי אפשר להתחיל. אפשר לאשר שוב, או בהגדרות הטלפון ← אפליקציות ← גלריה מסודרת ← הרשאות ← תמונות.
          </p>
        )}
        <button type="button" onClick={onStart} className="py-3 rounded-xl bg-accent text-accent-ink font-bold text-lg">
          {isNative ? 'לסרוק את הגלריה' : 'לנסות על גלריה לדוגמה'}
        </button>
        {!isNative && (
          <a href="galeria.apk" download className="py-3 rounded-xl border-2 border-accent text-accent font-bold">
            📲 להורדת האפליקציה לאנדרואיד
          </a>
        )}
        {!isNative && (
          <p className="text-xs text-muted">
            זו תצוגה בדפדפן עם תמונות מצוירות. בטלפון אנדרואיד – מתקינים את האפליקציה וכך היא עוברת על הגלריה האמיתית.
          </p>
        )}
      </div>
    </div>
  );
}
