import Layout from '../components/Layout';
import { RECIPE } from '../data/recipe';

export default function Recipe() {
  return (
    <Layout title="מתכון ללביבות" back="#/extras">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div role="alert" className="rounded-2xl border-2 border-bad bg-bad-soft p-4 flex gap-3 items-start">
          <span className="text-3xl" aria-hidden="true">⚠️</span>
          <div>
            <div className="font-extrabold text-bad text-xl">מכינים רק עם מבוגר!</div>
            <p className="m-0">{RECIPE.warning}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="card p-5 lg:col-span-2">
            <h2 className="mt-0 text-xl font-extrabold">🥔 {RECIPE.title}</h2>
            <div className="text-muted mb-2">{RECIPE.yields}</div>
            <div className="font-extrabold mb-1">מצרכים</div>
            <ul className="m-0 ps-5">
              {RECIPE.ingredients.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section className="card p-5 lg:col-span-3">
            <div className="font-extrabold mb-2 text-xl">אופן ההכנה</div>
            <ol className="m-0 ps-5 flex flex-col gap-2">
              {RECIPE.steps.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
            <p className="mb-0 mt-4 font-bold">בתיאבון! 😋</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
