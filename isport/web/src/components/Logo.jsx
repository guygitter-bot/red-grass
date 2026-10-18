// הלוגו של Isport: חולצה בירוק ניאון עם i, ולידה השם. אותו סמל כמו public/icon.svg
export function Mark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M24 10 L13 14.5 L6 26 L13.5 31 L17 27 L17 54 L47 54 L47 27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 13.5 35.5 15.5 32 15.5 C28.5 15.5 25.5 13.5 24 10 Z"
        fill="#c4f43a"
      />
      <circle cx="32" cy="25" r="3.6" fill="#0c0d0f" />
      <path d="M29 31.5 H35.5 L33.5 47 H27 Z" fill="#0c0d0f" />
    </svg>
  );
}

export default function Logo({ size = 'text-2xl', mark = 'h-9 w-9' }) {
  return (
    <span dir="ltr" className="inline-flex items-center gap-1.5">
      <Mark className={mark} />
      <span className={`font-brand ${size} leading-none tracking-tight`} style={{ transform: 'skewX(-8deg)' }}>
        <span className="text-lime">i</span>
        <span>SPORT</span>
      </span>
    </span>
  );
}
