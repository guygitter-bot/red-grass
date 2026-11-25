import Layout, { H2 } from '../components/Layout';
import { useApp } from '../context';
import { recallRate, streak, incubation, topTags } from '../lib/stats';
import { kindById } from '../lib/kinds';
import { MOODS } from '../lib/store';

function Bar({ value, max, className = 'bg-accent' }) {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2.5 rounded-full bg-soft overflow-hidden" aria-hidden="true">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// תובנות: זכירה, רצף, הצלחת זימון לפי סוג, סמלים חוזרים
export default function Insights() {
  const { data } = useApp();
  const r14 = recallRate(data.entries, 14);
  const r30 = recallRate(data.entries, 30);
  const days = streak(data.entries);
  const inc = incubation(data.nights, data.entries);
  const tags = topTags(data.entries, 10);
  const dreams = data.entries.filter((e) => e.type === 'dream');
  const lucid = dreams.filter((e) => e.lucid).length;
  const moods = MOODS.map((m, i) => [m, dreams.filter((e) => e.mood === i).length]);
  const maxMood = Math.max(1, ...moods.map((m) => m[1]));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  if (data.entries.length === 0) {
    return (
      <Layout title="תובנות" tab="#/insights">
        <div className="text-center py-10 max-w-md mx-auto">
          <p className="serif text-2xl font-bold m-0">עוד אין מספיק לילות</p>
          <p className="text-muted">אחרי כמה בקרים של רישום, יופיעו כאן אחוז הזכירה, מה עבד בזימון ואילו סמלים חוזרים אצלך.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="תובנות" tab="#/insights">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="sheet p-5">
          <H2 className="text-lg">זכירת חלומות</H2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="serif text-3xl font-bold text-accent">{pct(r14.hit, r14.days)}%</div>
              <div className="text-sm text-muted">14 לילות</div>
            </div>
            <div>
              <div className="serif text-3xl font-bold text-accent">{pct(r30.hit, r30.days)}%</div>
              <div className="text-sm text-muted">30 לילות</div>
            </div>
            <div>
              <div className="serif text-3xl font-bold text-accent">{days}</div>
              <div className="text-sm text-muted">ברצף ביומן</div>
            </div>
          </div>
          <p className="text-sm text-muted mb-0 mt-3">נהוג להמליץ על רישום קבוע כדי לזכור יותר. כאן אפשר לראות אם זה עובד אצלך.</p>
        </section>

        <section className="sheet p-5">
          <H2 className="text-lg">הצלחת הזימון</H2>
          {inc.total.tried === 0 ? (
            <p className="text-muted m-0">עוד אין לילה עם כוונה ורישום בבוקר שאחריו.</p>
          ) : (
            <>
              <p className="m-0 mb-3">
                מתוך <b>{inc.total.tried}</b> לילות עם כוונה: <b className="text-dawn">{inc.total.yes}</b> חלומות על הנושא, ועוד <b>{inc.total.partly}</b> ברמז.
              </p>
              <ul className="list-none p-0 m-0 grid gap-3">
                {inc.rows.map((r) => (
                  <li key={r.kind}>
                    <div className="flex justify-between text-sm">
                      <span>{kindById(r.kind).icon} {kindById(r.kind).name}</span>
                      <span className="text-muted">{r.yes + r.partly}/{r.tried}</span>
                    </div>
                    <Bar value={r.yes + r.partly} max={r.tried} className="bg-dawn" />
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-sm text-muted mb-0 mt-3">במחקר של ברט (1993) כמחצית מהמשתתפים חלמו על הנושא בתוך שבוע. לא כל לילה – וזה צפוי.</p>
        </section>

        <section className="sheet p-5">
          <H2 className="text-lg">סמלים שחוזרים</H2>
          {tags.length === 0 ? (
            <p className="text-muted m-0">כשמוסיפים תגיות לחלומות (ים, בית, אבא...) – הסמלים החוזרים יופיעו כאן.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(([t, n]) => (
                <a key={t} href={`#/journal/${encodeURIComponent(t)}`} className="chip no-underline text-inherit">
                  {t} <span className="text-muted text-sm">×{n}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="sheet p-5">
          <H2 className="text-lg">התחושה בחלומות</H2>
          <ul className="list-none p-0 m-0 grid gap-2">
            {moods.map(([m, n]) => (
              <li key={m} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                <span className="text-xl" aria-hidden="true">{m}</span>
                <Bar value={n} max={maxMood} />
                <span className="text-sm text-muted text-start">{n}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted mb-0 mt-3">
            {dreams.length} חלומות ביומן · {lucid} צלולים
          </p>
        </section>
      </div>
    </Layout>
  );
}
