export default function Header({ title, back, children }) {
  return (
    <header className="sticky top-0 z-30 bg-page/95 backdrop-blur border-b border-line">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        {back && (
          <a href={back} className="w-9 h-9 rounded-full bg-card border border-line grid place-items-center text-lg" aria-label="חזרה">
            →
          </a>
        )}
        <h1 className="flex-1 text-xl font-bold truncate">{title}</h1>
        {children}
      </div>
    </header>
  );
}
