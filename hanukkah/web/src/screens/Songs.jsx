import Layout from '../components/Layout';
import { BLESSINGS, HANEROT_HALALU, MAOZ_TZUR, SONGS_TO_SING } from '../data/texts';

export default function Songs() {
  return (
    <Layout title="שירים וברכות" back="#/extras">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mt-0 text-xl font-extrabold">🙏 הברכות על הדלקת הנרות</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {BLESSINGS.map((b) => (
              <div key={b.id} className="rounded-2xl bg-soft p-4">
                <div className="font-extrabold text-accent">{b.title}</div>
                <div className="text-sm text-muted mb-2">{b.when}</div>
                <p className="m-0 text-lg leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mt-0 text-xl font-extrabold">🕯️ {HANEROT_HALALU.title}</h2>
          <p className="m-0 text-lg leading-relaxed">{HANEROT_HALALU.text}</p>
        </section>

        <section className="card p-5">
          <h2 className="mt-0 text-xl font-extrabold">🎶 {MAOZ_TZUR.title}</h2>
          <p className="m-0 text-lg leading-loose">
            {MAOZ_TZUR.lines.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </p>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mt-0 text-xl font-extrabold">🎤 שירים לשיר בחנוכה</h2>
          <p className="mt-0 text-muted">את המילים מכירים מהגן, מהבית ומהרדיו. הנה כמה שמות לחפש ולשיר ביחד:</p>
          <div className="flex flex-wrap gap-2">
            {SONGS_TO_SING.map((s) => (
              <span key={s} className="rounded-full bg-soft px-4 py-2 font-bold">{s}</span>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
