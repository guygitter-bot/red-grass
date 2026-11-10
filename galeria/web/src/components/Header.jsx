export default function Header({ title, back, children }) {
  return (
    <header className="sticky top-0 z-30 bg-page/95 backdrop-blur border-b border-line pt-[var(--safe-top)]">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        {back && (
          <a href={back} className="shrink-0 h-11 px-4 rounded-full bg-accent text-accent-ink font-bold flex items-center gap-1.5" aria-label="חזרה">
            <span className="text-lg">→</span> חזרה
          </a>
        )}
        <h1 className="flex-1 text-xl font-bold truncate">{title}</h1>
        {children}
      </div>
    </header>
  );
}
