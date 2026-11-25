import { useState } from 'react';
import { useApp } from '../context';
import { isDark, toggleTheme } from '../lib/theme';

const TABS = [
  { href: '#/', label: 'הלילה', icon: '☾' },
  { href: '#/journal', label: 'יומן', icon: '✎' },
  { href: '#/insights', label: 'תובנות', icon: '✦' },
  { href: '#/learn', label: 'ללמוד', icon: '❖' },
];

// מסגרת: כותרת, ניווט (למטה בטלפון, למעלה במחשב), הודעה קופצת
export default function Layout({ title, back, children, tab }) {
  const { toast } = useApp();
  const [dark, setDark] = useState(isDark());

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-page/90 backdrop-blur border-b border-line" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-5xl flex items-center gap-2 px-4 h-14">
          {back ? (
            <a href={back} className="btn btn-sm px-3 border-transparent" aria-label="חזרה">
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <span className="serif text-accent text-2xl leading-none" aria-hidden="true">☾</span>
          )}
          <h1 className="serif flex-1 m-0 text-lg lg:text-xl font-bold truncate">{title}</h1>
          <nav className="hidden lg:flex gap-1" aria-label="ניווט ראשי">
            {TABS.map((t) => (
              <a key={t.href} href={t.href} className={`btn btn-sm border-transparent ${tab === t.href ? 'bg-soft text-accent' : ''}`} aria-current={tab === t.href ? 'page' : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
          <a href="#/settings" className="btn btn-sm w-11 px-0 border-transparent" aria-label="הגדרות">
            ⚙
          </a>
          <button className="btn btn-sm w-11 px-0 border-transparent" aria-label={dark ? 'מעבר למצב יום' : 'מעבר למצב לילה'} onClick={() => setDark(toggleTheme())}>
            {dark ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main className="flex-1 w-full mx-auto max-w-5xl px-4 pt-5 pb-28 lg:pb-12">{children}</main>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-line grid grid-cols-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="ניווט ראשי">
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={`flex flex-col items-center justify-center min-h-14 no-underline text-xs ${tab === t.href ? 'text-accent font-bold' : 'text-muted'}`} aria-current={tab === t.href ? 'page' : undefined}>
            <span className="text-xl leading-none" aria-hidden="true">{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
      {toast && (
        <div role="status" className="fade-in fixed bottom-20 lg:bottom-6 inset-x-4 z-30 mx-auto max-w-sm rounded-2xl bg-ink text-page text-center font-semibold py-3 px-4 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

export function H2({ children, className = '' }) {
  return <h2 className={`serif text-xl lg:text-2xl font-bold mt-0 mb-3 ${className}`}>{children}</h2>;
}
