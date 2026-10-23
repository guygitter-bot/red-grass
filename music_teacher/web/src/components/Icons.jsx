// אייקונים קטנים (SVG בשורה)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconBack = (p) => (
  <svg {...base} {...p}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconNext = (p) => (
  <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconPlay = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M6 3.5v17l14-8.5z" /></svg>
);
export const IconStop = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);
export const IconMic = (p) => (
  <svg {...base} {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
);
export const IconSpeaker = (p) => (
  <svg {...base} {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.500 8.500 0 010 12" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M5 13l4 4L19 7" /></svg>
);
export const IconTheme = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4.500" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400" /></svg>
);
export const IconTune = (p) => (
  <svg {...base} {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></svg>
);
export const IconReplay = (p) => (
  <svg {...base} {...p}><path d="M3 12a9 9 0 109-9 9 9 0 00-6.700 3M3 4v4h4" /></svg>
);
export const IconLock = (p) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
);
