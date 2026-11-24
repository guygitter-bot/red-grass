# פרומפטיקה (Promptika)

כלי פנימי לבעלים אחד, שבונה כלי AI לעסקים קטנים: קליטת לקוח (הכלים שיש לו / מה חסר) → Claude ממליץ על כלי AI,
כותב אפיון ומעריך **שעות** → הקוד מחשב עלות הקמה ותחזוקה לפי ההגדרות.

> **שלב נוכחי:** כניסה, לקוחות, הגדרות, שרת וטופס הקליטה (9 חלקים). ההצעות האוטומטיות יתווספו בהמשך
> על ידי 👨‍💻 המתכנת של `tsevet/` – שעורך רק קבצים בתוך `promptika/`.

- **האפליקציה** – https://promptika.pages.dev (`web/`, React + Vite + Tailwind, RTL, PWA)
- **השרת** – Worker `promptika-api` (`api/`) + Durable Object `Studio` אחד (`main`) לכל הנתונים.

## מסכים (ניווט לפי #)
- **כניסה** – בפעם הראשונה קובעים סיסמה, אחר כך נכנסים איתה.
- `#/` – רשימת לקוחות + "לקוח חדש".
- `#/client/:id` – כרטיס לקוח: שם ועסק, טופס הקליטה (9 חלקים מתקפלים, שמירה אוטומטית) והצעות.
- `#/client/:id/proposal/:pid` – **מסך ההצעה** (8 סעיפים: הבנת הלקוח, המלצה, אפיון לכל כלי, לוח זמנים, עלות הקמה, תחזוקה חודשית, תנאים, צעד הבא).
  כל טקסט ומספר שעות ניתן לעריכה במקום; שמירה אוטומטית (800ms, "נשמר ✓") לגרסה הזאת בלבד (`PUT /clients/:id` עם כל מערך ההצעות).
  בורר גרסאות + "שכפול לגרסה חדשה" (`lib/proposals.js`; גרסה ישנה לא משתנה). "חבילה אחת / 3 חבילות". אין קישור ציבורי – הבעלים שולח בעצמו:
  "הדפסה / PDF" (`window.print()`, CSS הדפסה ב-`index.css`: דף לבן, כותרת Promptika, בלי כפתורים) ו"העתקה לוואטסאפ" (`lib/summary.js`).
  הקוד: `screens/Proposal.jsx`, `components/proposal/*`, `components/Editable.jsx`, `lib/useProposalSave.js`.
- `#/settings` – הגדרות התמחור + יציאה.

## מבנה השרת (`api/`)
- `worker.js` – רק מסדר את הכתובות (CORS לאתר עצמו, גודל בקשה) ומעביר ל-`Studio`.
- `studio.js` – ה-Durable Object: קודם כתובות בלי כניסה, אחר כך בדיקת session, ואז שאר הכתובות.
- `routes/auth.js`, `routes/settings.js`, `routes/clients.js` – כל קובץ מחזיר תשובה או `null`.
- `lib/auth.js` (סיסמה ב-PBKDF2, אסימונים, 5 ניסיונות שגויים ל-10 דקות), `lib/model.js` (`safeSettings`, `safeClient`), `lib/http.js`.

| כתובת | מה |
|---|---|
| `GET /status` | האם כבר נקבעה סיסמה (בלי כניסה) |
| `POST /login {password}` | בפעם הראשונה קובע סיסמה; מחזיר `token` (בלי כניסה) |
| `POST /logout` | יציאה מהמכשיר |
| `GET` / `PUT /settings` | הגדרות (עדכון חלקי) |
| `GET` / `POST /clients` | רשימה / לקוח חדש |
| `GET` / `PUT` / `DELETE /clients/:id` | לקוח אחד |
| `POST /clients/:id/propose` | Claude ממליץ על 2-5 כלים ומעריך שעות → גרסה חדשה בהצעות (עד 10 בשעה) |

## מבנה הנתונים (ב-Studio)
- `auth` – `{ salt, hash, tries, tokens }` (הסיסמה רק כ-hash, האסימונים רק כ-sha256).
- `settings` – `hourlyRate` (₪), `hostingMonthly` (₪), `apiMonthlyAvg` (₪), `depositPercent` (50), `revisionRounds` (2), `vatIncluded` (false).
- `client:<id>` – `{ id, name, business, createdAt, updatedAt, intake: {…}, proposals: [] }`.
- `intake` (טופס הקליטה, הכול אופציונלי; `safeIntake` ב-`api/lib/model.js`, מראה ב-`web/src/lib/intake.js` – לשנות בשניהם):
  - `business` `{ name, field, employees, roles }` · `offer` `{ items, topEarner }` · `customers` `{ ideal, reach }`
  - `tools` – שורות `{ tool, purpose, monthlyCost (₪) }` · `pains` – שורות `{ pain, lastTime, frequency, hoursPerMonth }` · `missing` – שורות טקסט
  - `goal` `{ success }` · `budget` `{ budget, timeline }`
  - `tech` `{ maintain: 'yes'|'no'|'partly'|'', dataLocation, decider, sensitive: 'yes'|'no'|'', sensitiveNote }`
  - מספר ריק = `''`; עד 30 שורות לכל רשימה; מפתחות לא מוכרים נזרקים. שמירה אוטומטית (800ms) ב-`PUT /clients/:id`, וטיוטה ב-localStorage (`pk_draft_<id>`) עד שמירה מוצלחת.
  - הגדרות החלקים והתוויות: `web/src/data/intakeSections.js`; הממשק: `web/src/components/Intake.jsx`.
- הצעה (בתוך הלקוח) – `{ id, version, createdAt, understanding, missingQuestions[], tools[], timeline[{stage,duration}], nextStep, notes }`.
  כלי: `{ name, problem, benefit 1-5, effort 1-5, savedHoursPerMonth, estimate: true, input, output, users, screens[], integrations[],
  notIncluded[], buildHours: { spec, build, test, training }, monthlyHours, apiMonthlyEstimate, range, rangeDrivers }`.
  הצעה ישנה (מהשלד) עם `buildHours` כמספר נקראת כשעות "בנייה" (`safeProposal`). גרסה חדשה לא דורסת ישנה.

כל שדה אופציונלי ומקבל ברירת מחדל ב-`safeSettings` / `safeClient` – נתונים ישנים ממשיכים לעבוד. שדה חדש = ברירת מחדל שם.

## ההצעה מ-Claude (`api/lib/propose.js`, `api/lib/ai.js`)
- רק מהשרת (`ANTHROPIC_API_KEY`), `claude-opus-5-5` עם fallback. ההנחיה בעברית (`SYSTEM_HE`) – כפי שהבעלים ניסח, לא לשנות בלי לשאול.
- התשובה JSON בלבד, נבדקת בקוד; לא תקינה → ניסיון אחד נוסף → שגיאה בעברית.
- כל שדה כסף שהמודל מחזיר נמחק (`stripMoney`, חוץ מ-`apiMonthlyEstimate` שבסכמה); שעות מוגבלות ל-0–500; כלים מדורגים לפי תועלת פחות מאמץ.
- רק שאלות חסרות (בלי כלים) → לא נשמרת גרסה, השאלות מוצגות מעל ההצעות.
- תוכן הקליטה לא נכתב ללוג. בדיקות עם Claude מדומה (`propose.test.js`).

## כסף – רק בקוד
**ה-AI מחזיר רק שעות, לעולם לא סכומים.** החישוב ב-`web/src/lib/pricing.js` (פונקציות טהורות + בדיקות):
- הקמה = שורות לפי שלב (אפיון / בנייה / בדיקות / הדרכה): שעות × תעריף = סכום (`packageCost`).
- חודשי = שעות תחזוקה × תעריף + אחסון (פעם אחת לחבילה) + AI (סכום `apiMonthlyEstimate` של הכלים; בלי הערכה – `apiMonthlyAvg`), כל רכיב בשורה משלו.
- חבילות (`packagesOf`): בסיס = הכלי הראשון; מומלץ = 2 הראשונים (2-3 כלים) או 3 (4+); מורחב = הכול. כלי אחד – הכול זהה. "חבילה אחת" = כל הכלים.
- תנאים (`termsOf`): מקדמה וסבבי תיקונים מההגדרות; שינוי היקף ובעלות על הקוד – טקסט קבוע. תווית מע"מ לפי `vatIncluded`.
- הסכומים מחושבים בכל רינדור ולא נשמרים.
- מקדמה = אחוז מההקמה. מע"מ (18%) נוסף אם `vatIncluded` כבוי.

שינוי התעריף בהגדרות משנה מיד את כל הסכומים.

## מותג
כתום (ראשי, כפתורים), כחול-לילה (רקעים כהים, כותרת), טורקיז (הדגשה) – משתנים ב-`web/src/index.css`.
הלוגו "Promptika" ב-"Press Start 2P" (פיקסלים); כותרות בעברית – Rubik מודגש; טקסט – Rubik. ניגודיות 4.5:1 לפחות, גם במצב לילה.

## אבטחה ופרטיות – המאגר ציבורי
- אין נתוני לקוחות, שמות או מפתחות בקוד, בבדיקות או בלוגים. בבדיקות – רק נתונים מומצאים.
- CSP ב-`web/public/_headers`: `connect-src` = כתובת השרת המדויקת. שירות חיצוני חדש מהדפדפן מחייב עדכון שם.
- השרת עונה רק לאתר עצמו (`ALLOWED_ORIGINS` ב-`api/wrangler.toml`).

## סודות
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY` – קיימים כבר ב-GitHub. אין סודות חדשים: הסיסמה נקבעת באפליקציה.

## בדיקה
`cd promptika/api && npm test` · `cd promptika/web && npm test && npm run build`

לבדיקה בדפדפן: לבנות עם `VITE_API_URL=http://localhost:8787` ולהריץ את ה-Worker מקומית (או שרת מדומה סביב `worker.js`).
