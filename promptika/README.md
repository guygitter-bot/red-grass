# פרומפטיקה (Promptika)

כלי פנימי לבעלים אחד, שבונה כלי AI לעסקים קטנים: קליטת לקוח (הכלים שיש לו / מה חסר) → Claude ממליץ על כלי AI,
כותב אפיון ומעריך **שעות** → הקוד מחשב עלות הקמה ותחזוקה לפי ההגדרות.

> **שלב נוכחי: שלד.** כניסה, לקוחות, הגדרות ושרת. טופס הקליטה (9 חלקים) וההצעות האוטומטיות יתווספו בהמשך
> על ידי 👨‍💻 המתכנת של `tsevet/` – שעורך רק קבצים בתוך `promptika/`.

- **האפליקציה** – https://promptika.pages.dev (`web/`, React + Vite + Tailwind, RTL, PWA)
- **השרת** – Worker `promptika-api` (`api/`) + Durable Object `Studio` אחד (`main`) לכל הנתונים.

## מסכים (ניווט לפי #)
- **כניסה** – בפעם הראשונה קובעים סיסמה, אחר כך נכנסים איתה.
- `#/` – רשימת לקוחות + "לקוח חדש".
- `#/client/:id` – כרטיס לקוח: שם ועסק, מקום לטופס הקליטה ולהצעות.
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
| `POST /clients/:id/propose` | עוד לא – מחזיר 501 (ה-AI יגיע בהמשך) |

## מבנה הנתונים (ב-Studio)
- `auth` – `{ salt, hash, tries, tokens }` (הסיסמה רק כ-hash, האסימונים רק כ-sha256).
- `settings` – `hourlyRate` (₪), `hostingMonthly` (₪), `apiMonthlyAvg` (₪), `depositPercent` (50), `revisionRounds` (2), `vatIncluded` (false).
- `client:<id>` – `{ id, name, business, createdAt, updatedAt, intake: {}, proposals: [] }`.
- הצעה (בתוך הלקוח) – `{ id, version, createdAt, tools: [{ name, problem, spec, buildHours, monthlyHours }], notes }`.

כל שדה אופציונלי ומקבל ברירת מחדל ב-`safeSettings` / `safeClient` – נתונים ישנים ממשיכים לעבוד. שדה חדש = ברירת מחדל שם.

## כסף – רק בקוד
**ה-AI מחזיר רק שעות, לעולם לא סכומים.** החישוב ב-`web/src/lib/pricing.js` (פונקציות טהורות + בדיקות):
- הקמה = שעות הקמה × תעריף לשעה.
- חודשי = שעות תחזוקה בחודש × תעריף + אחסון + AI (אחסון ו-AI פעם אחת להצעה).
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
