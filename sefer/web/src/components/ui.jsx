// רכיבים קטנים משותפים
export function ErrorBox({ error, detail }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl bg-bad-soft text-bad px-4 py-3 text-sm">
      <div className="font-semibold">{error}</div>
      {detail ? <div dir="ltr" className="mt-1 text-xs opacity-80 break-words text-left">{detail}</div> : null}
    </div>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} className={`chip ${value === o.id ? 'chip-on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}{o.hint ? <span className="opacity-70 font-normal"> · {o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ title, onBack, children }) {
  return (
    <header className="sticky top-0 z-10 bg-page/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-3xl flex items-center gap-2 px-4 h-14">
        {onBack ? <button type="button" className="btn !min-h-10 !px-3" onClick={onBack} aria-label="חזרה">→</button> : null}
        <h1 className="flex-1 min-w-0 truncate text-lg font-bold m-0">{title}</h1>
        {children}
      </div>
    </header>
  );
}

// כריכת ספר: תמונה (אם יש) עם שם הספר מעליה
export function Cover({ title, subtitle, src, small }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-accent text-accent-ink shadow-md aspect-[3/4] ${small ? 'w-20' : 'w-full'}`}>
      {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : null}
      {small ? (
        src ? null : <div className="absolute inset-0 flex items-center justify-center p-1 text-center text-[11px] book-title">{title}</div>
      ) : (
        <div className={`absolute inset-x-0 top-0 p-5 text-center ${src ? 'bg-gradient-to-b from-black/70 via-black/35 to-transparent text-white pb-16' : 'h-full flex flex-col justify-center'}`}>
          <div className="book-title text-3xl lg:text-4xl" style={{ textShadow: src ? '0 2px 8px rgb(0 0 0 / 0.6)' : 'none' }}>{title}</div>
          {subtitle ? <div className="mt-2 text-base opacity-95" style={{ textShadow: src ? '0 1px 6px rgb(0 0 0 / 0.6)' : 'none' }}>{subtitle}</div> : null}
        </div>
      )}
    </div>
  );
}
