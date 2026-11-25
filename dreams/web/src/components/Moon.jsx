// ירח – הסמל של האפליקציה. phase: 0 = מלא, 1 = סהר דק
export default function Moon({ size = 120, phase = 0.55, className = '', glow = true }) {
  const off = 30 + phase * 40;
  const id = `m${Math.round(phase * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="200" height="200" fill="#fff" />
          <circle cx={100 + off} cy={100 - off * 0.55} r="72" fill="#000" />
        </mask>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#c9b8f2" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#c9b8f2" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow && <circle cx="100" cy="100" r="98" fill={`url(#${id}g)`} />}
      <circle cx="100" cy="100" r="66" fill="#efe6d2" mask={`url(#${id})`} />
    </svg>
  );
}
