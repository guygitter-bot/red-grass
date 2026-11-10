// אריח גדול לניווט
export default function Tile({ href, icon, title, sub, badge }) {
  return (
    <a
      href={href}
      className="card relative flex flex-col items-center justify-center text-center gap-1 p-4 min-h-32 no-underline text-ink hover:border-accent transition-colors"
    >
      <span className="text-4xl lg:text-5xl" aria-hidden="true">{icon}</span>
      <span className="text-lg lg:text-xl font-extrabold">{title}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
      {badge != null && <span className="absolute top-2 end-3 text-sm font-bold text-accent">{badge}</span>}
    </a>
  );
}
