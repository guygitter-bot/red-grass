// חלקים משותפים למסך ההמלצות: עטיפת סעיף, תג "הערכה", נקודות דירוג

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

// דירוג 1-5 בנקודות, עם טקסט נגיש
export const Dots = ({ label, value }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`${label} ${value}/5`}>
    {label}
    <span aria-hidden className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-2 rounded-full ${n <= value ? 'bg-turq' : 'bg-line'} print:border print:border-black`} />)}
    </span>
    <bdi className="sr-only print:not-sr-only">{value}/5</bdi>
  </span>
);

export const EstimateTag = () => (
  <span className="rounded-full border border-orange px-2 py-0.5 text-xs font-bold text-orange-ink">הערכה</span>
);
