// חלקים משותפים למסך ההצעה: עטיפת סעיף, סכום עם ₪, תג "הערכה"
import { shekel } from '../../lib/pricing';

// סעיף ממוספר. לא נשבר באמצע בהדפסה
export function Section({ n, title, children, className = '' }) {
  return (
    <section className={`proposal-section rounded-xl border border-line bg-card p-4 lg:p-5 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-ink">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-night px-1.5 text-sm text-orange print:bg-transparent print:text-black">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// סכום ב-₪ שלא מתהפך בעברית
export const Money = ({ v, className = '' }) => <bdi dir="ltr" className={className}>{shekel(v)}</bdi>;
export const Num = ({ v }) => <bdi dir="ltr">{v}</bdi>;

export const EstimateTag = () => (
  <span className="rounded-full border border-orange px-2 py-0.5 text-xs font-bold text-orange-ink">הערכה</span>
);
