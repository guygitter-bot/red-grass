import Layout from '../components/Layout';
import { CUSTOMS } from '../data/customs';
import { BLESSINGS } from '../data/texts';

export default function Customs() {
  return (
    <Layout title="מנהגי החג" back="#/">
      <div className="grid gap-4 lg:grid-cols-2">
        {CUSTOMS.map((c) => (
          <article key={c.id} className={`card p-5 ${c.blessings ? 'lg:col-span-2' : ''}`}>
            <h2 className="flex items-center gap-3 text-xl lg:text-2xl font-extrabold m-0 mb-3">
              <span className="text-3xl" aria-hidden="true">{c.icon}</span>
              {c.title}
            </h2>
            {c.body.map((t, n) => (
              <p key={n} className="mt-0 mb-2">{t}</p>
            ))}
            {c.bullets && (
              <ul className="m-0 ps-5 flex flex-col gap-1">
                {c.bullets.map((b, n) => (
                  <li key={n}>{b}</li>
                ))}
              </ul>
            )}
            {c.blessings && (
              <div className="grid gap-3 lg:grid-cols-3 mt-3">
                {BLESSINGS.map((b) => (
                  <div key={b.id} className="rounded-2xl bg-soft p-4">
                    <div className="font-extrabold text-accent">{b.title}</div>
                    <div className="text-sm text-muted mb-2">{b.when}</div>
                    <p className="m-0 text-lg leading-relaxed">{b.text}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </Layout>
  );
}
