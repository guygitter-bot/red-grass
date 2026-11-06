import Header from '../components/Header.jsx';
import Thumb from '../components/Thumb.jsx';
import { KINDS, potential } from '../lib/cleanup.js';
import { SOURCES, TOPICS } from '../lib/categories.js';
import { bytes, count } from '../lib/format.js';
import { getTheme, setTheme } from '../lib/theme.js';
import { useState } from 'react';

function kindStats(result, key, sizeOf) {
  if (key === 'dup' || key === 'similar') {
    const gs = result[key];
    return { n: gs.reduce((s, g) => s + g.ids.length - 1, 0), size: gs.reduce((s, g) => s + g.save, 0), cover: gs[0]?.ids[0], groups: gs.length };
  }
  const ids = result.lists[key] || [];
  return { n: ids.length, size: ids.reduce((s, id) => s + sizeOf(id), 0), cover: ids[0] };
}

const THEMES = { auto: '🌓', light: '☀️', dark: '🌙' };

export default function Home({ photos, result, sizeOf, onRescan, demo }) {
  const [theme, setThemeState] = useState(getTheme());
  const total = photos.reduce((s, p) => s + (p.size || 0), 0);
  const pot = potential(result, sizeOf);
  const nextTheme = () => {
    const t = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
    setTheme(t);
    setThemeState(t);
  };

  return (
    <div className="pb-10">
      <Header title="גלריה מסודרת">
        <button type="button" onClick={nextTheme} className="w-9 h-9 rounded-full bg-card border border-line" aria-label="מצב לילה">
          {THEMES[theme]}
        </button>
        <button type="button" onClick={onRescan} className="px-3 h-9 rounded-full bg-card border border-line text-sm">
          ↻ סריקה
        </button>
      </Header>
      <main className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-6">
        {demo && (
          <p className="text-sm bg-soft rounded-xl p-3">
            🎨 זו גלריה לדוגמה (תמונות מצוירות). באפליקציה בטלפון רואים כאן את התמונות האמיתיות.
          </p>
        )}
        <section className="bg-card border border-line rounded-3xl p-5 flex flex-col gap-1">
          <p className="text-muted">בגלריה</p>
          <p className="text-3xl font-bold">
            {count(photos.length)} תמונות · {bytes(total)}
          </p>
          {pot.count > 0 ? (
            <p className="text-good font-semibold mt-1">
              ✨ אפשר לפנות כ־{bytes(pot.bytes)} ({count(pot.count)} תמונות מיותרות)
            </p>
          ) : (
            <p className="text-good font-semibold mt-1">✨ הגלריה מסודרת – אין כרגע מה לנקות</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">מה אפשר למחוק</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {KINDS.map((k) => {
              const st = kindStats(result, k.key, sizeOf);
              return (
                <a
                  key={k.key}
                  href={`#/clean/${k.key}`}
                  className={`flex items-center gap-3 bg-card border border-line rounded-2xl p-3 ${st.n ? '' : 'opacity-55'}`}
                >
                  {st.cover ? (
                    <Thumb id={st.cover} size={200} className="w-16 h-16 rounded-xl shrink-0" />
                  ) : (
                    <span className="w-16 h-16 rounded-xl bg-soft grid place-items-center text-2xl shrink-0">{k.icon}</span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold">
                      {k.icon} {k.label}
                    </span>
                    <span className="block text-sm text-muted truncate">{k.desc}</span>
                    <span className="block text-sm mt-0.5">
                      {st.n ? (
                        <>
                          <b>{count(st.n)}</b> {st.groups ? `תמונות ב־${count(st.groups)} קבוצות` : 'תמונות'} · {bytes(st.size)}
                        </>
                      ) : (
                        'אין'
                      )}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">לפי נושא</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {TOPICS.map((t) => {
              const ids = result.byTopic[t.key] || [];
              return (
                <a key={t.key} href={`#/topic/${t.key}`} className="bg-card border border-line rounded-2xl overflow-hidden">
                  {ids[0] ? (
                    <Thumb id={ids[0]} size={200} className="aspect-square" />
                  ) : (
                    <span className="aspect-square bg-soft grid place-items-center text-3xl">{t.icon}</span>
                  )}
                  <span className="block p-2 text-center text-sm leading-tight">
                    <b>{t.label}</b>
                    <br />
                    <span className="text-muted">{count(ids.length)}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">לפי מקור</h2>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <a key={s.key} href={`#/source/${s.key}`} className="px-4 py-2 rounded-full bg-card border border-line text-sm">
                {s.icon} {s.label} <span className="text-muted">({count((result.bySource[s.key] || []).length)})</span>
              </a>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted text-center">
          🔒 הכול נעשה בתוך הטלפון. מה שנמחק עובר לפח של הגלריה ואפשר לשחזר אותו במשך 30 יום.
        </p>
      </main>
    </div>
  );
}
