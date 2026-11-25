import Layout, { H2 } from '../components/Layout';
import Moon from '../components/Moon';
import { useApp } from '../context';
import { nightKey, isMorning, nightLabel } from '../lib/night';
import { kindById } from '../lib/kinds';
import { recallRate, streak } from '../lib/stats';

// המסך הראשי: בערב – הכוונה ללילה; בבוקר – לרשום את החלום
export default function Home() {
  const { data } = useApp();
  const key = nightKey();
  const intention = data.nights[key];
  const morning = isMorning();
  const loggedTonight = data.entries.some((e) => e.night === key && e.type !== 'nap');
  const rate = recallRate(data.entries);
  const days = streak(data.entries);
  const recent = data.entries.slice(0, 3);

  return (
    <Layout title="זימון חלומות" tab="#/">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <section className="sky rounded-[28px_28px_28px_8px] p-6 pe-20 lg:p-8 lg:pe-28 relative overflow-hidden">
          <Moon size={130} phase={morning ? 0.15 : 0.6} className="absolute -top-8 -left-8 opacity-90" />
          <p className="text-sm m-0 opacity-70">{nightLabel(key)}</p>
          {morning && loggedTonight ? (
            <>
              <h2 className="serif text-3xl lg:text-4xl font-bold mt-2 mb-3 leading-tight">החלום של הלילה<br />נרשם.</h2>
              <p className="m-0 mb-5 opacity-85 max-w-md">בערב אפשר לבחור כוונה חדשה. עד אז – אולי עולה עוד פרט, או חלום נוסף מאותו לילה.</p>
              <div className="flex flex-wrap gap-2">
                <a href="#/journal" className="btn btn-primary">ליומן</a>
                <a href="#/morning" className="btn border-white/25 text-[#efe6d2]">להוסיף חלום</a>
              </div>
            </>
          ) : morning ? (
            <>
              <h2 className="serif text-3xl lg:text-4xl font-bold mt-2 mb-3 leading-tight">בוקר טוב.<br />מה חלמת?</h2>
              <p className="m-0 mb-5 opacity-85 max-w-md">
                {intention ? (
                  <>ביקשת לחלום על: <span className="serif">{intention.text || kindById(intention.kind).name}</span>. כדאי לרשום עכשיו, לפני שהחלום נמוג.</>
                ) : (
                  'כדאי לרשום עכשיו, לפני שהחלום נמוג. גם קטע קטן או תחושה.'
                )}
              </p>
              <a href="#/morning" className="btn btn-dawn">לרשום את החלום</a>
            </>
          ) : intention ? (
            <>
              <p className="m-0 mt-2 text-sm opacity-70">הכוונה של הלילה</p>
              <p className="serif text-2xl lg:text-3xl font-bold mt-1 mb-4 leading-snug max-w-md">{intention.phrase || kindById(intention.kind).name}</p>
              <div className="flex flex-wrap gap-2">
                <a href="#/ritual" className="btn btn-primary">{intention.ritual ? 'לחזור על טקס השינה' : 'להתחיל את טקס השינה'}</a>
                <a href="#/intend" className="btn border-white/25 text-[#efe6d2]">לשנות</a>
              </div>
            </>
          ) : (
            <>
              <h2 className="serif text-3xl lg:text-4xl font-bold mt-2 mb-3 leading-tight">על מה לחלום<br />הלילה?</h2>
              <p className="m-0 mb-5 opacity-85 max-w-md">שאלה, רעיון, אדם או מקום. מנסחים כוונה קצרה, עושים טקס שינה של חמש דקות, וברגע ההתעוררות רושמים.</p>
              <a href="#/intend" className="btn btn-primary">לבחור כוונה ללילה</a>
            </>
          )}
        </section>

        <div className="grid gap-5">
          <section className="sheet p-5">
            <H2 className="text-lg lg:text-xl">תנומת אדיסון</H2>
            <p className="m-0 mb-4 text-muted">
              מחזיקים את הירח על המסך ונרדמים. כשהיד משתחררת – צלצול עדין מעיר, ורושמים מה עלה. ברגעי ההירדמות המוח יצירתי במיוחד.
            </p>
            <a href="#/nap" className="btn btn-sm">לתנומה של 10–20 דקות</a>
          </section>

          <section className="sheet p-5 grid grid-cols-2 gap-3 text-center">
            <a href="#/insights" className="no-underline text-inherit">
              <div className="serif text-3xl font-bold text-accent">{rate.hit}<span className="text-base text-muted">/{rate.days}</span></div>
              <div className="text-sm text-muted">לילות עם חלום שנזכר</div>
            </a>
            <a href="#/insights" className="no-underline text-inherit">
              <div className="serif text-3xl font-bold text-accent">{days}</div>
              <div className="text-sm text-muted">{days === 1 ? 'לילה ברצף ביומן' : 'לילות ברצף ביומן'}</div>
            </a>
          </section>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <H2>מהיומן</H2>
          {recent.length > 0 && <a href="#/journal" className="text-accent text-sm">לכל היומן</a>}
        </div>
        {recent.length === 0 ? (
          <p className="text-muted m-0">היומן ריק. החלום הראשון שיירשם יופיע כאן.</p>
        ) : (
          <ul className="list-none p-0 m-0 grid gap-3 lg:grid-cols-3">
            {recent.map((e) => (
              <li key={e.id}>
                <EntryCard e={e} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!data.settings.seenIntro && (
        <section className="mt-8 sheet p-5 bg-soft">
          <H2 className="text-lg">איך זה עובד</H2>
          <ol className="m-0 ps-5 grid gap-1">
            <li>בערב: בוחרים על מה לחלום ומנסחים משפט קצר.</li>
            <li>לפני השינה: טקס של חמש דקות – נשימה, תמונה, חזרה על המשפט.</li>
            <li>בהתעוררות: לא זזים, נזכרים, ורושמים מיד – גם קטע קטן.</li>
            <li>לאורך זמן: היומן מראה מה עובד ואילו סמלים חוזרים.</li>
          </ol>
          <p className="mb-0 mt-3 text-sm text-muted">הכול נשמר רק בטלפון שלך. <a href="#/learn" className="text-accent">על המחקר שמאחורי השיטה</a></p>
        </section>
      )}
    </Layout>
  );
}

export function EntryCard({ e }) {
  const label = e.type === 'nap' ? 'תנומה' : e.type === 'none' ? 'לא נזכרתי' : null;
  const rel = { yes: 'קשור לכוונה', partly: 'קשור חלקית' }[e.related];
  return (
    <a href={`#/entry/${e.id}`} className="sheet block p-4 no-underline text-inherit h-full hover:border-accent">
      <div className="flex gap-2 text-xs text-muted">
        <span>{nightLabel(e.night)}</span>
        {label && <span className="text-accent">{label}</span>}
        {rel && <span className="text-dawn">{rel}</span>}
        {e.lucid && <span className="text-accent">צלול</span>}
      </div>
      <p className="serif font-bold m-0 mt-1">{e.title || (e.type === 'none' ? 'לילה בלי חלום שנזכר' : 'בלי כותרת')}</p>
      {(e.text || e.glimpses[0]) && <p className="m-0 mt-1 text-sm text-muted line-clamp-2">{e.text || e.glimpses[0]}</p>}
    </a>
  );
}
