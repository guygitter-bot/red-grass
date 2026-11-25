import Layout, { H2 } from '../components/Layout';

// הצד הלימודי: מה ידוע במחקר, מה מסורת, ואיך לתרגל. כל נתון עם מקור.
const STUDIES = [
  {
    title: 'ועדת השינה, 1993',
    who: 'דירדרה ברט',
    text: 'סטודנטים בחרו בעיה אמיתית (שיעורי בית, החלטה אישית) והתרגלו כוונה לפני השינה במשך שבוע. כמחצית חלמו חלום שהרגישו שקשור לבעיה, וכ-70% מהם האמינו שהחלום הכיל פתרון. ההנחיות שלה הן הבסיס לטקס השינה באפליקציה.',
    src: 'https://asdreams.org/journal/articles/barrett3-2.htm',
    srcName: 'Barrett, Dreaming 3(2), 1993',
  },
  {
    title: 'רגע ההירדמות הוא "נקודה מתוקה" ליצירתיות – פריז, 2021',
    who: 'Lacaux ועמיתים, Science Advances',
    text: 'נבדקים פתרו תרגילים שהסתתר בהם כלל קיצור. בהפסקה הם נמנמו עם בקבוק ביד (כמו הכדור של אדיסון). מי שבילה לפחות 15 שניות בשלב ההירדמות הראשון (N1) גילה את הכלל ב-83% מהמקרים, לעומת 30% אצל מי שנשאר ער. מי שצלל לשינה עמוקה יותר – איבד את היתרון.',
    src: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8654287',
    srcName: 'Lacaux et al., Science Advances, 2021',
  },
  {
    title: 'זימון חלום ממוקד – MIT, 2020 ו-2023',
    who: 'אדם האר הורוביץ ועמיתים, MIT Media Lab',
    text: 'ההתקן Dormio מזהה הירדמות, משמיע תזכורת לחשוב על נושא, מעיר בעדינות ומבקש לספר מה עלה. בניסוי עם 49 משתתפים, מי שנמנם עם זימון ממוקד היה יצירתי ב-43% יותר במבחנים אחרי התנומה. החוקרים מדגישים שאפשר לעשות את זה גם בלי ההתקן שלהם.',
    src: 'https://news.mit.edu/2023/sleep-sweet-spot-dreams-creativity-0515',
    srcName: 'MIT News, 2023',
  },
  {
    title: 'חלומות בשנת REM ופתרון חידות – נורת׳ווסטרן',
    who: 'Konkoly, Paller ועמיתים',
    text: 'במעבדת שינה גרמו לנבדקים לחלום, בזמן שנת REM, על חידות שלא פתרו. החוקרים מדווחים שחלומות כאלה יכולים לתרום לפתרון למחרת – רמז לכך שגם החלום עצמו, ולא רק המחשבה לפני השינה, משחק תפקיד.',
    src: 'https://faculty.wcas.northwestern.edu/~paller/NeuroCSC2026.pdf',
    srcName: 'Paller lab, Northwestern',
  },
  {
    title: 'חלום צלול: מה עובד',
    who: 'Aspy ועמיתים, אוסטרליה, 2017 ו-2020',
    text: 'במחקרים גדולים, השיטה MILD – לחזור על "בפעם הבאה שאחלום, אזכור שזה חלום" ולדמיין את עצמך מזהה את החלום – בשילוב התעוררות קצרה לפנות בוקר (WBTB) הייתה מהיעילות. "בדיקות מציאות" לבד היו חלשות יותר. מי שזוכר יותר חלומות הצליח יותר.',
    src: 'https://doi.org/10.3389/fpsyg.2020.01746',
    srcName: 'Aspy et al., Frontiers in Psychology, 2020',
  },
];

export default function Learn() {
  return (
    <Layout title="ללמוד" tab="#/learn">
      <article className="max-w-2xl mx-auto">
        <p className="serif text-2xl lg:text-3xl font-bold leading-snug mt-0">
          זימון חלום הוא לבקש מהלילה להביא חלום על נושא מסוים. זה לא קסם – אבל זה גם לא רק אגדה.
        </p>

        <H2 className="mt-8">מסורת עתיקה</H2>
        <p>
          במצרים ובמסופוטמיה העתיקות ישנו במקדשים כדי לקבל חלום. ביוון, חולים לנו במקדשי אסקלפיוס בתקווה לחלום מרפא. ביהדות יש מנהג של "שאלת חלום" – לשאול שאלה לפני השינה ולקבל תשובה בחלום; ידוע במיוחד הספר "שאלות ותשובות מן השמים" של ר׳ יעקב ממרויש (המאה ה-13).
          <span className="text-muted"> אלה מסורות ומנהגים – לא ראיות מדעיות.</span>
        </p>
        <p className="mt-3">
          גם אדיסון ודאלי נמנמו, כך מסופר, עם חפץ ביד שנפל והעיר אותם ברגע ההירדמות. <span className="text-muted">זה סיפור, לא מחקר – אבל ב-2021 בדקו אותו במעבדה (למטה).</span>
        </p>

        <H2 className="mt-8">מה המחקר מצא</H2>
        <ul className="list-none p-0 m-0 grid gap-4">
          {STUDIES.map((s) => (
            <li key={s.title} className="sheet p-5">
              <h3 className="serif text-lg font-bold m-0">{s.title}</h3>
              <p className="text-sm text-muted m-0 mb-2">{s.who}</p>
              <p className="m-0">{s.text}</p>
              <a href={s.src} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-accent">מקור: {s.srcName}</a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted mt-3">
          בשורה התחתונה: הכוונה לפני השינה מעלה את הסיכוי לחלום על הנושא, ושלב ההירדמות טוב במיוחד לרעיונות. אין הבטחה לחלום מסוים בלילה מסוים, והמחקרים עדיין קטנים יחסית. יש גם חוקרים שספקנים לגבי מידת התועלת.
        </p>

        <H2 className="mt-8">השיטה באפליקציה</H2>
        <ol className="ps-5 grid gap-2">
          <li><b>שאלה אחת, ממוקדת.</b> עדיף משהו שחשבת עליו גם במהלך היום.</li>
          <li><b>משפט קצר</b> בגוף ראשון ובזמן עתיד, וחזרה עליו לפני השינה.</li>
          <li><b>תמונה אחת</b> שמייצגת את השאלה – לדמיין אותה בפרטים.</li>
          <li><b>התעוררות שקטה:</b> לא לזוז, לשאול "מה חלמתי?", ולרשום מיד.</li>
          <li><b>לקרוא את החלום כמשל:</b> התשובה מגיעה לרוב בתמונות. מה החלום אומר אם הוא תשובה?</li>
          <li><b>להתמיד:</b> לנסות כמה לילות ברציפות. ההצלחה מצטברת.</li>
        </ol>

        <H2 className="mt-8">שיטות נוספות</H2>
        <dl className="grid gap-3">
          <div>
            <dt className="font-bold">תנומת אדיסון (כאן באפליקציה)</dt>
            <dd className="m-0 text-muted">לנצל את דקות ההירדמות לרעיונות. 10–20 דקות, באמצע היום או לפני השינה.</dd>
          </div>
          <div>
            <dt className="font-bold">התעוררות קצרה לפנות בוקר (WBTB)</dt>
            <dd className="m-0 text-muted">שעון מעורר כ-5 שעות אחרי ההירדמות, 10–20 דקות ערות, חזרה על הכוונה, וחזרה לישון. החלומות הארוכים הם לקראת הבוקר. זה מקטע את השינה – לא כל לילה.</dd>
          </div>
          <div>
            <dt className="font-bold">MILD – לחלום צלול</dt>
            <dd className="m-0 text-muted">לבחור "כוונה: חלום צלול", ולחזור על המשפט ולדמיין את הרגע שבו מבינים בתוך החלום שזה חלום.</dd>
          </div>
        </dl>

        <section className="sheet bg-dawn-soft p-5 mt-8">
          <H2 className="text-lg">בריאות ובטיחות</H2>
          <ul className="ps-5 m-0 grid gap-1">
            <li>זה לא טיפול ולא ייעוץ רפואי.</li>
            <li>שיטות שמעירות באמצע הלילה מקטעות את השינה. מי שסובל מנדודי שינה או מבעיית שינה – עדיף לא, או רק בתיאום עם רופא.</li>
            <li>סיוטים חוזרים, טראומה או מצוקה נפשית – כדאי לפנות לאיש מקצוע. יש טיפולים יעילים לסיוטים (למשל "חזרה על דמיון", IRT).</li>
            <li>חלום הוא לא נבואה ולא הוראה. מחליטים בעירות, בשיקול דעת.</li>
          </ul>
          <p className="text-sm text-muted mb-0 mt-2">
            <a className="text-accent" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6874013/" target="_blank" rel="noopener noreferrer">על הסיכונים של השיטות לחלום צלול</a>
            {' · '}
            <a className="text-accent" href="https://www.sleepfoundation.org/dreams/dangers-of-lucid-dreaming" target="_blank" rel="noopener noreferrer">Sleep Foundation</a>
          </p>
        </section>
      </article>
    </Layout>
  );
}
