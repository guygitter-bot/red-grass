// אייקונים מצוירים בקו אחד (24x24, עובי 1.8) – במקום אמוג'י, כדי שהממשק ייראה אחיד
const PATHS = {
  // תוף (מבט מהצד) עם שני מקלות
  drum: (
    <>
      <ellipse cx="12" cy="11" rx="8" ry="3" />
      <path d="M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" />
      <path d="M6.5 3.5l4 5M17.5 3.5l-4 5" />
    </>
  ),
  // נצנוץ – גימור הסטים
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  metronome: (
    <>
      <path d="M8.5 20h7L17 8.5 13.5 3h-3L7 8.5z" />
      <path d="M12 16l3-8" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11.2v4.3c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.3M21.5 9v5.5" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  pause: <path d="M8 5.5v13M16 5.5v13" strokeWidth="3.2" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />,
  loop: (
    <>
      <path d="M17 3.5l3 3-3 3M4 11V9.5a3 3 0 0 1 3-3h13" />
      <path d="M7 20.5l-3-3 3-3M20 13v1.5a3 3 0 0 1-3 3H4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3.5 3.5V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  chevronUp: <path d="M6 14.5l6-6 6 6" />,
  bulb: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3.5z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  rotate: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M3 9.5a9 9 0 0 1 3-2.5M21 14.5a9 9 0 0 1-3 2.5" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
