// שלושה כוכבים לדירוג (0..3): מלאים בענבר, ריקים בקו. label = תיאור לקורא מסך
export default function Stars({ n = 0, size = 14, label }) {
  return (
    <span className="stars inline-flex items-center gap-px" role="img" aria-label={label || `${n} מתוך 3 כוכבים`} data-stars={n}>
      {[1, 2, 3].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8" strokeLinejoin="round" className={i <= n ? 'star-on' : 'star-off'} aria-hidden="true" focusable="false">
          <path d="M12 3.6l2.5 5.3 5.8.8-4.2 4.1 1 5.8-5.1-2.7-5.1 2.7 1-5.8-4.2-4.1 5.8-.8z" />
        </svg>
      ))}
    </span>
  );
}
