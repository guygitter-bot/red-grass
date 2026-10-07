# הנחיות לעבודה במאגר

## תקשורת
- לכתוב למשתמשת **רק בעברית**, בשפה פשוטה ולא טכנית. היא לא מתכנתת ואין לה גישה ל-GitHub.
- הודעות commit ותיאורי PR: התיאור בעברית, הודעת ה-commit באנגלית.

## חיסכון במכסה
- לבחור את המודל הקטן ביותר שמתאים למשימה, ולהעביר אליו את העבודה (subagent עם מודל מתאים):
  - שינוי קטן (טקסט, צבע, כפתור, באג ממוקד) – המודל הקטן והזול ביותר.
  - פיצ'ר בינוני (מסך, שדה חדש, שינוי בכמה קבצים) – מודל בינוני.
  - רגיש (סנכרון, שרת, אבטחה, התראות, פתרון התנגשויות) – המודל הנוכחי.
- לקרוא רק את הקבצים שהשינוי צריך. לא לסרוק את כל המאגר.
- תשובות קצרות.

## אפליקציית "סדר" (`seder/`)
אפליקציית משימות בעברית (RTL) למשתמשת אחת. **לקרוא קודם את `seder/README.md`** – שם מתואר הכול.
- `seder/web` – האפליקציה (React + Vite + Tailwind). עולה ל-https://seder-tasks.pages.dev.
- `seder/api` – שרת (Cloudflare Worker + Durable Object): סנכרון, סיסמה, התראות, בקשות לשינוי.
- עלייה לאוויר: אוטומטית אחרי מיזוג ל-main (`.github/workflows/seder.yml`).

### לפני כל שינוי
- **לבדוק אם יש PR פתוח מענף `seder/request-*`** (בקשות שנשלחו מתוך האפליקציה). אם הוא נוגע באותם קבצים –
  לשלב אותו בענף העבודה (merge) כדי שלא תהיה התנגשות, ולספר למשתמשת.
- לעבוד מעל `origin/main` העדכני.

### כללים בקוד
- הכול חייב לעבוד **בטלפון ובמחשב** (מסך רחב: `lg:`), **ובמצב לילה**: רקעים עם `bg-card` / `bg-page`, לא `bg-white`.
- לא לשבור נתונים קיימים: שדה חדש במשימה חייב לעבוד גם במשימות ישנות שאין להן אותו (הנתונים מסתנכרנים בין מכשירים).
- `useEffect` תמיד עם גוף בסוגריים מסולסלים (פונקציה שמחזירה ערך גרמה לקריסה ב-Chrome החדש).
- הערות בקוד בעברית, באותו סגנון כמו הקוד הקיים.

### בדיקה לפני שליחה
- `cd seder/web && npm test && npm run build`
- `cd seder/api && npm test`
- לשינוי במסכים: לבדוק בדפדפן (Playwright מותקן; לבנות עם `VITE_API_URL` לשרת מקומי).

### אחרי שה-PR מוכן
- לתת למשתמשת **קישור למיזוג** ולהסביר במשפט מה לבדוק אחרי העלייה (בדרך כלל: לסגור ולפתוח את האפליקציה).
- PR שנפתח בשיחה ממוזג ב-GitHub. בקשות שנשלחו מתוך האפליקציה מאושרות מתוך האפליקציה.

## שאר האפליקציות במאגר
לכל אחת: לקרוא קודם את ה-README שלה. כללים מיוחדים שנקבעו בשיחות אחרות – לבקש מאותה שיחה להוסיף כאן.

### ביס – ניקוד אוכל (`points_tracker/`)
- תיאור: `points_tracker/README.md`. האפליקציה ב-`points_tracker/web`, השרת ב-`points_tracker/proxy`.
- עלייה: `bis-deploy.yml` – **staging** (ענף `staging` → https://staging.bis-app.pages.dev) לפני **production**
  (main → https://bis-app.pages.dev). בקשות תיקון מתוך האפליקציה: `bis-fix.yml` (ענפים `bis-fix/*`).
- סוכן המאכלים: `points-agent.yml`. הנוסחה זהה ב-`web/src/lib/points.js` וב-`points.py` – לשנות בשניהם.

### mat-kon – מתכונים (`mat_kon/`)
ספר מתכונים בעברית (RTL, PWA) למשפחה. **לקרוא קודם את `mat_kon/README.md`**.
- `mat_kon/web` – האפליקציה (React + Vite + Tailwind) → https://mat-kon.pages.dev.
- `mat_kon/api` – שרת (Cloudflare Worker + Durable Objects: `RecipeBook` לכל ספר, `Accounts` אחד) → https://mat-kon-api.guygitter.workers.dev.
- עלייה: `mat-kon.yml` אחרי מיזוג ל-main (בודק ובונה גם ב-PR).

#### עבודה מול המשתמש
- לענות **רק בעברית**, פשוט וקצר.
- "תבנה ותמזג": לבנות, לבדוק, לפתוח PR, **למזג בעצמך**, ואחר כך לבדוק שהעלייה (`mat-kon.yml` על main) הצליחה ולדווח –
  כולל "לסגור ולפתוח את האפליקציה מחדש". כשמבקשים רק דעה ("מה דעתך?") – להציע ולחכות לאישור.
- כשהמשתמש צריך לעשות משהו בעצמו (Google Cloud, סוד ב-GitHub) – לחלק לצעדים קצרים עם קישורים ישירים.

#### סודות ואבטחה
- מפתחות רק כסודות ב-GitHub, לעולם לא בקוד: `ANTHROPIC_API_KEY`, `CHEAPERSAL_API_KEY`, `GOOGLE_CLIENT_ID`, `OWNER_PASSWORD`,
  `OWNER_EMAIL`, `GOOGLE_TTS_KEY`. לא לבקש סיסמאות או מפתחות בצ'אט. לא לחבר חשבונות רשתות חברתיות של משתמשים.
- הספר של הבעלים נעול (fail-closed). `OWNER_OPEN=true` רק בבדיקות (`api/fake-env.js`).
- CSP ב-`web/public/_headers`: `connect-src` הוא כתובת השרת המדויקת – שירות חיצוני חדש מהדפדפן מחייב עדכון שם.
- קישור ששותף (`?url=` או דרך ה-service worker) תמיד רק מוצע באישור – גם "שיתוף" יכול להגיע מאתר זר.

#### כללים בקוד
- הכול בעברית ומימין לשמאל, מותאם קודם לטלפון. הערות בקוד בעברית בסגנון הקיים.
- `useEffect` תמיד עם גוף בסוגריים מסולסלים (`window.scrollTo` שהוחזר מ-effect הפיל את האפליקציה בכרום החדש).
- נתונים ישנים חייבים להמשיך לעבוד: מתכונים עוברים `safeRecipe`, שדה חדש צריך ברירת מחדל.
- רשימות משותפות (קניות, מלאי, תכנון) מסתנכרנות בפעולות לפריט (`/<list>/ops`) – לא לשלוח רשימה שלמה.
- הוספה מקישור רצה ברקע (`/recipes?async=1` + `/jobs/:id`); שחזור/ייבוא (`/recipes/restore`) – בלי AI ובלי מכסה.
- הודעות שגיאה של AI למשתמש – בעברית. המודל: `claude-opus-5-5` (beta עם fallback), עלויות נרשמות במסך "עלויות ותקלות".
- תגיות (האשטגים) **לא מוצגות** בממשק (נשמרות רק לחיפוש). קטגוריות במסך משלהן (`#/categories`); סדר ומועדפות נשמרים בשרת לכל ספר.
- ה-service worker לא שומר קובצי `.mp4` (סרטוני ההדרכה עוברים ישר לרשת).

#### בדיקה לפני שליחה
- `cd mat_kon/api && npm test` · `cd mat_kon/web && npx vitest run src && npm run build`
- שינוי במסך: לבדוק בדפדפן עם Playwright (`/opt/node22/lib/node_modules/playwright/index.mjs`, chromium ב-`/opt/pw-browsers/chromium`)
  ושרת מדומה (`page.route('**/mat-kon-api**/**', …)`). ה-chromium כאן ישן ובלי H.264 – סרטונים לא מתנגנים בו, זה לא באג.
- לא להשתמש ב-`pkill -f` (הורג את ה-shell).
- קריסה אצל המשתמש: מסך "משהו השתבש" ומסך "עלויות ותקלות" מציגים `הודעה @ רכיב` (שם מכווץ). לבנות את אותו commit
  ולחפש `function <שם>(` ב-`dist/assets` כדי למצוא את הרכיב.

#### סרטוני הדרכה (`mat_kon/tutorials/`)
- מוקלטים אוטומטית מהאפליקציה (שרת מדומה, בלי AI): `cd mat_kon/web && npm run build`, ואז `cd ../tutorials && node videos/<שם>.mjs`.
- **שינוי במסך → להקליט מחדש את הסרטון שלו.** רשימת הסרטונים: `web/src/lib/tutorials.js`.
- קריינות: משפט חדש נכנס ל-`tutorials/voice/lines.json`; דחיפה לענף עבודה מפעילה את `mat-kon-voice.yml` שמחזיר את קובצי ה-MP3
  לענף – ואז `git pull` ולהקליט שוב. הקול: ElevenLabs, הקול "נועה" (`tutorials/voice/eleven.json`, סוד `ELEVENLABS_API_KEY`);
  Google TTS רק כגיבוי. **בלי ניקוד** – ניסינו, ונשמע גרוע יותר.
- מוזיקה: `tutorials/music.m4a` – "Stylish Modern" של Beat and Shine מ-ElevenLabs (רישיון מסחרי במנוי), מחוברת לעצמה ללופ.

#### ייבוא
- My Recipe Box / RecetteTek (`.rtk`): `web/src/lib/importers.js`, דרך הגדרות ← "ייבוא מאפליקציה אחרת". מתכון בלי מצרכים
  אפשר "להשלים מהמקור" (נשלח לסוכן ברקע).

### מאגר AI (`ai_maagar/`)
- תיאור: `ai_maagar/README.md`. קישורים וקבצים על AI שממופים לקטגוריות לפי נושא (Claude, ברקע ב-Durable Object alarm).
- `ai_maagar/web` → https://ai-maagar-631.pages.dev · `ai_maagar/api` → Worker `ai-maagar-api`. עלייה: `ai-maagar.yml` אחרי מיזוג ל-main.
- בדיקה: `cd ai_maagar/api && npm test` · `cd ai_maagar/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.

### טוטו (`toto_predictor/`)
- תיאור: `toto_predictor/README.md`. רץ בהפעלה ידנית (`toto-weekly.yml`), האתר ב-GitHub Pages (`pages-deploy.yml`).

### חשבוניות סקאלה (`scala_invoices/`)
- תיאור: `scala_invoices/README.md`. רץ פעם בחודש (`scala-invoices.yml`).
