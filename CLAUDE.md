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
- סוכן המאכלים: `points-agent.yml`. הנוסחה זהה ב-`web/src/lib/points.js`, ב-`points.py` וב-`mat_kon/web/src/lib/bis.js` – לשנות בכולם.

### ביסים – הגרסה המסחרית (`bisim/`)
- תיאור: `bisim/README.md`. אפליקציה נפרדת לגמרי מ"ביס" (קוד, שרת `bisim-api`, מאגר ומכשירים משלה) → https://bisim.pages.dev.
- עלייה: `bisim.yml` אחרי מיזוג ל-main (בודק ובונה גם ב-PR). שינוי בביס לא עובר לביסים לבד, ולהפך.
- **בלי שומרי משקל:** נוסחת "ביסים" משלנו (`bisim/web/src/lib/bites.js`: אנרגיה עם הנחה על חלבון וסיבים). לא להשתמש
  בנוסחת PointsPlus, ולא בשמות, במונחים ("נקודות", Points) או בטבלאות ניקוד של שומרי משקל – לא בקוד, לא בממשק,
  לא בשיווק ולא בהנחיות לסוכן.

### mat-kon – מתכונים (`mat_kon/`)
ספר מתכונים בעברית (RTL, PWA) למשפחה. **לקרוא קודם את `mat_kon/README.md`**.
- `mat_kon/web` – האפליקציה (React + Vite + Tailwind) → https://mat-kon.pages.dev.
- `mat_kon/api` – שרת (Cloudflare Worker + Durable Objects: `RecipeBook` לכל ספר, `Accounts` אחד) → https://mat-kon-api.guygitter.workers.dev.
- עלייה: `mat-kon.yml` אחרי מיזוג ל-main (בודק ובונה גם ב-PR).

#### עבודה מול המשתמש
- **רעיונות ושדרוגים שלא בוצעו:** `mat_kon/IDEAS.md`. כל הצעה שלא מבצעים מיד – נכנסת לשם; מה שבוצע – יוצא משם.
  כשהמשתמש שואל "מה יש לנו ברעיונות" – לקרוא משם ולסכם.
- לענות **רק בעברית**, פשוט וקצר.
- "תבנה ותמזג": לבנות, לבדוק, לפתוח PR, **למזג בעצמך**, ואחר כך לבדוק שהעלייה (`mat-kon.yml` על main) הצליחה ולדווח –
  כולל "לסגור ולפתוח את האפליקציה מחדש". כשמבקשים רק דעה ("מה דעתך?") – להציע ולחכות לאישור.
- כשהמשתמש צריך לעשות משהו בעצמו (Google Cloud, סוד ב-GitHub) – לחלק לצעדים קצרים עם קישורים ישירים.

#### סודות ואבטחה
- מפתחות רק כסודות ב-GitHub, לעולם לא בקוד: `ANTHROPIC_API_KEY`, `CHEAPERSAL_API_KEY`, `GOOGLE_CLIENT_ID`, `OWNER_PASSWORD`,
  `OWNER_EMAIL`, `GOOGLE_TTS_KEY`. לא לבקש סיסמאות או מפתחות בצ'אט. לא לחבר חשבונות רשתות חברתיות של משתמשים.
- מפתח החתימה לאנדרואיד: רק ב-R2 (`mat-kon-backups/signing/upload.jks`) + סוד `ANDROID_KEYSTORE_PASSWORD`. לעולם לא במאגר, ב-Artifact או בלוג.
- הספר של הבעלים נעול (fail-closed). `OWNER_OPEN=true` רק בבדיקות (`api/fake-env.js`).
- CSP ב-`web/public/_headers`: `connect-src` הוא כתובת השרת המדויקת – שירות חיצוני חדש מהדפדפן מחייב עדכון שם.
- קישור ששותף (`?url=` או דרך ה-service worker) תמיד רק מוצע באישור – גם "שיתוף" יכול להגיע מאתר זר.

#### כללים בקוד
- הכול בעברית ומימין לשמאל, מותאם קודם לטלפון. הערות בקוד בעברית בסגנון הקיים.
- `useEffect` תמיד עם גוף בסוגריים מסולסלים (`window.scrollTo` שהוחזר מ-effect הפיל את האפליקציה בכרום החדש).
- נתונים ישנים חייבים להמשיך לעבוד: מתכונים עוברים `safeRecipe`, שדה חדש צריך ברירת מחדל.
- רשימות משותפות (קניות, מלאי, תכנון) מסתנכרנות בפעולות לפריט (`/<list>/ops`) – לא לשלוח רשימה שלמה.
- הוספה מקישור רצה ברקע (`/recipes?async=1` + `/jobs/:id`); שחזור/ייבוא (`/recipes/restore`) – בלי AI ובלי מכסה.
- **אותו קישור = אותו מתכון אצל כל המשתמשים**: מטמון משותף (`api/jobs.js`, מופע `recipe-cache`, 90 יום) לפי הקישור ולפי זהות המקור (`sourceIdentity`). לא לעקוף אותו.
- הודעות שגיאה של AI למשתמש – בעברית. המודל: `claude-opus-5-5` (beta עם fallback), עלויות נרשמות במסך "עלויות ותקלות".
- תגיות (האשטגים) **לא מוצגות** בממשק (נשמרות רק לחיפוש). קטגוריות במסך משלהן (`#/categories`); סדר ומועדפות נשמרים בשרת לכל ספר.
- סינון (כשר, פסח, צליאק, רגישויות, תזונה, ציוד): `diet.js` זהה ב-`api/` וב-`web/src/lib/` (בדיקה מוודאת) – לשנות בשניהם. ה-AI מסמן `diet` בבניית מתכון (עם טביעת אצבע של המצרכים); אחרת לפי מילים.
- ניקוד ביס בדף המתכון – רק למשתמשים שבעל האפליקציה הפעיל להם (אפליקציית הניהול ← משתמשים, `user.features.bis`), לא לכולם (שיטה של שומרי משקל). הנוסחה ב-`web/src/lib/bis.js` זהה ל-`points_tracker` (בדיקה מוודאת).
- שיחה על מתכון בקהילה (טיפים, תשובות, "הכנתי!" עם תמונה): `talk:<key>` במופע community, תמונות ב-`/img/community/<id>`; כל טקסט/תמונה עוברים `moderateTalk`, דיווח ×3 מסתיר, ניהול ב-`/admin/talk`. בלי authorId ללקוח (`publicTalk`).
- "חסר לי?" ליד כל מצרך: `POST /recipes/:id/substitute` (`suggestSubstitutes`, רק מצרך שבמתכון, לפי הסינון שבחר המשתמש), התשובה נשמרת ב-`sub:<id>:<hash>` בספר.
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
- **לא להקליט בלי לשאול:** בכל תיקון או עדכון – לעצור ולשאול את המשתמש אם ליצור/לעדכן סרטון הדרכה (זה צורך מכסה, ולא לכל דבר צריך).
  רק אחרי אישור – להקליט. רשימת הסרטונים: `web/src/lib/tutorials.js`.
- קריינות: משפט חדש נכנס ל-`tutorials/voice/lines.json`; דחיפה לענף עבודה מפעילה את `mat-kon-voice.yml` שמחזיר את קובצי ה-MP3
  לענף – ואז `git pull` ולהקליט שוב. הקול: ElevenLabs, הקול "נועה" (`tutorials/voice/eleven.json`, סוד `ELEVENLABS_API_KEY`);
  Google TTS רק כגיבוי. **בלי ניקוד** – ניסינו, ונשמע גרוע יותר.
- מוזיקה: `tutorials/music.m4a` – "Stylish Modern" של Beat and Shine מ-ElevenLabs (רישיון מסחרי במנוי), מחוברת לעצמה ללופ.

#### אפליקציית הניהול (`mat_kon/admin`)
- → https://mat-kon-admin.pages.dev, רק לבעלים (סיסמת הבעלים), מותקנת מהדפדפן (לא דרך Google Play). עולה ב-`mat-kon.yml` (job `admin`).
- נתונים מ-`/admin/overview`, `/admin/issues`, `/admin/security`, `/admin/settings` (בדיקה בשרת: רק session של בעלים). תקלות מקובצות לפי סוג עם סטטוס (`issue:` ב-Accounts).
- התראות לטלפון (Web Push, `api/push.js`, מפתחות ב-`admin-vapid` ב-Accounts): תקלה חדשה/שחזרה, מתכון בקהילה שהוסתר או מחכה לבדיקה.
  לכל היותר התראה אחת בשעה לכל נושא. תקלות מקישורים מקובצות לפי סוג השגיאה והאתר (`errorGroup`), לא לפי הנוסח של ה-AI.
  "לא נמצא מתכון" (`NoRecipeError`) אינו תקלה: נשמר ברשימה נפרדת (`no-recipe`, לשונית "לא נמצא מתכון") בלי התראה. תקלה פתוחה שחוזרת – שולחת התראה.
  קריאת התקלות הפתוחות מכאן (בלי סיסמה בצ'אט): להפעיל את `mat-kon-issues.yml` ולקרוא את הלוג (מוסתרים אימיילים וקישורים).
- "שלח ל-Claude לטיפול" בתקלה: `api/fixes.js` פותח issue עם התווית `matkon-fix` (בלי אימיילים, קישורים רק כשם אתר – המאגר ציבורי),
  `mat-kon-fix.yml` + `mat_kon/fixbot/` מריצים את Claude ופותחים PR מ-`matkon-fix/<n>`; "לאשר ולהעלות" ממזג. טוקן: `MATKON_GITHUB_TOKEN` או `POINTS_GITHUB_TOKEN`.
  צילומי מסך מצורפים נשמרים ב-R2 (`fix-shots/`, 30 יום), ב-issue רק מזהה; ה-fixbot מוריד אותם בכניסת בעלים (`OWNER_PASSWORD`) ל-`.fix/` (לא נכנס ל-commit).
- בדיקה: `cd mat_kon/admin && npm test && npm run build`. טלפון + מחשב + מצב לילה (`bg-card` / `bg-page`).

#### גיבוי
- גיבוי לילי ל-R2 (`api/backup.js`, דלי `mat-kon-backups`, 30 ימים); שחזור ספר: `mat-kon-restore.yml`. שינוי במבנה הנתונים של ספר –
  לוודא שהגיבוי והשחזור (`/backup/export`, `/backup/import`) עדיין מכסים אותו.

#### ייבוא
- "מתכון מקובץ" (Word, PDF, טקסט, תמונות, epub...) במסך `#/import`: הקריאה בטלפון (`web/src/lib/files.js`, בלי AI), ורק הקטעים שנבחרו נשלחים
  (`/recipes/text` עם `file: true`; PDF סרוק – כמו צילום). קובץ חדש? להוסיף קורא ב-`readRecipeFile` + בדיקה ב-`files.test.js`.
- My Recipe Box / RecetteTek (`.rtk`), Paprika (`.paprikarecipes`), Recipe Keeper (ZIP עם `recipes.html`), Cookmate (`.mcb` / XML): `web/src/lib/importers.js` (`readImportFile` מזהה לפי התוכן), דרך הגדרות ← "ייבוא מאפליקציה אחרת". Google Keep (Takeout): `web/src/lib/keep.js` – פתקים נכנסים למסך ייבוא מווטסאפ (`#/import`) ונשלחים ל-AI כמו טקסט. מתכון בלי מצרכים
  אפשר "להשלים מהמקור" (נשלח לסוכן ברקע).

### מאגר AI (`ai_maagar/`)
- תיאור: `ai_maagar/README.md`. קישורים וקבצים על AI שממופים לקטגוריות לפי נושא (Claude, ברקע ב-Durable Object alarm).
- `ai_maagar/web` → https://ai-maagar-631.pages.dev · `ai_maagar/api` → Worker `ai-maagar-api`. עלייה: `ai-maagar.yml` אחרי מיזוג ל-main.
- בדיקה: `cd ai_maagar/api && npm test` · `cd ai_maagar/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.

### ארץ עיר (`eretz_ir/`)
- תיאור: `eretz_ir/README.md`. משחק לכמה שחקנים בקישור, עם שם ותמונה; 9 קטגוריות (כולל מאכל); ניקוד 10 (רק אחד) / 5 (כמה), בונוס 10 למי שסיים ראשון (עם צלצול).
- `eretz_ir/web` → https://eretz-ir.pages.dev · `eretz_ir/api` → Worker `eretz-ir-api` (Durable Object `Room` לכל משחק). עלייה: `eretz-ir.yml` אחרי מיזוג ל-main.
- בדיקה: `cd eretz_ir/api && npm test` · `cd eretz_ir/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- בדיקת תשובות אוטומטית בסוף סיבוב (`api/spell.js`, Claude Opus ב-alarm): תיקון כתיב (באותה אות) + האם מתאים לקטגוריה; כל פסילה נבדקת שוב בבודק שני עם חיפוש ברשת, וארצות מ-`api/countries.js` תמיד נכונות (לא מתאים = 0, השחקנים יכולים לאשר ב-👍). אות אחת לבד = 0.
- קהילות חברים + התראות "בואו לשחק" (`api/club.js`, Durable Object `Club`, Web Push ב-`api/push.js`; מפתחות ב-`~vapid`).
- הקטגוריות ובדיקת האות כפולות ב-`api/game.js` וב-`web/src/lib/game.js` – לשנות בשניהם.

### מה השיר? – זיהוי שירים (`ma_hashir/`)
- תיאור: `ma_hashir/README.md`. משחק לכמה שחקנים בקישור (לבד או קבוצות), 5 שניות משיר ו-4 תשובות; הארכה ל-10 שניות (5 נק׳), 50:50 כל 30 נקודות.
- `ma_hashir/web` → https://ma-hashir.pages.dev · `ma_hashir/api` → Worker `ma-hashir-api` (Durable Object `Room` לכל משחק, `Library` אחד לקטעי השירים). עלייה: `ma-hashir.yml` אחרי מיזוג ל-main.
- בדיקה: `cd ma_hashir/api && npm test` · `cd ma_hashir/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- רשימת השירים: `api/songs.js`; הקטעים מ-iTunes/Deezer דרך השרת (`/audio`). ההגדרות כפולות ב-`api/game.js` וב-`web/src/lib/game.js`.

### רוק סיטי – מערכת שעות (`rock_city/`)
- תיאור: `rock_city/README.md`. מערכת שעות לבית ספר למוזיקה: שיעורים, תלמידים, מורים, חדרים, תשלומים, בקשות לשינוי והרשאות.
- `rock_city/web` → https://rock-city-school.pages.dev · `rock_city/api` → Worker `rock-city-api` (Durable Object `School` אחד). עלייה: `rock-city.yml` אחרי מיזוג ל-main.
- בדיקה: `cd rock_city/api && npm test` · `cd rock_city/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- הרשאות נבדקות בשרת (`api/school.js`). צבעי המותג: צהוב-זהב ושחור (`web/src/index.css`). תאריך עברי + מספר: מקף עברי (`ב־${...}`) כדי שלא יתהפך.

### הרוכשים – הטבות לקבוצת רכישה (`harochshim/`)
- תיאור: `harochshim/README.md` (אפיון: `harochshim/spec.html`). קטגוריות → ספקים → הצעות מחיר; עוזר AI לכל ספק שמעביר ליד חם לספק.
- `harochshim/web` → https://harochshim.pages.dev (`#/admin` מנהל, `#/partner/<סוד>` ספק) · `harochshim/api` → Worker `harochshim-api` (Durable Object `Club`). עלייה: `harochshim.yml` אחרי מיזוג ל-main.
- בדיקה: `cd harochshim/api && npm test` · `cd harochshim/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- ספק לא נמחק – רק "מורד מהרשימה" (`active: false`). ספק רואה רק את הלידים שלו (נבדק בשרת). צבעי הלוגו ב-`web/src/index.css`.

### צוות – בוטים של שיווק ב-Telegram (`tsevet/`)
- תיאור: `tsevet/README.md`. בוטים עם תפקידים (🎨 קריאייטיב, 📊 קמפיינים) בקבוצת Telegram עם נושאים; מדברים ביניהם (`handoff`).
- `tsevet/api` → Worker `tsevet-api` (Durable Object `Team` אחד, עבודה ברקע ב-alarm). עלייה: `tsevet.yml` אחרי מיזוג ל-main.
- בדיקה: `cd tsevet/api && npm test`. בוט חדש = מפתח ב-`AGENTS` (`api/agents.js`) + סוד `TG_<KEY>_TOKEN` ב-workflow.
- הבוטים לא מוציאים כסף בלי אישור מפורש של הבעלים (בכפתור). רק הבעלים מדבר איתם.

### Isport – חנות חולצות כדורגל (`isport/`)
- תיאור: `isport/README.md`. קטלוג חולצות בלי סליקה/עגלה: התאמה אישית -> הערה למוכר (מועתקת) -> קישור FlyLinking.
- `isport/web` → https://isport-shop.pages.dev (`#/admin` ניהול) · `isport/api` → Worker `isport-api` (Durable Object `Shop`, תמונות ב-R2 `isport-images`). עלייה: `isport.yml` אחרי מיזוג ל-main.
- בדיקה: `cd isport/api && npm test` · `cd isport/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- קוד המוצר, הפאצ'ים והקטגוריות (סוגים: football / basketball / plain) כפולים ב-`api/model.js` וב-`web/src/lib/shirt.js` – לשנות בשניהם.
- סיסמאות: `ISPORT_ADMIN_PASSWORD` = המשתמש (מי שבנה); לבעל החנות סיסמה נפרדת שנקבעת בהגדרות. גיבוי לילי ל-R2 (30 יום) ושחזור בהגדרות. מפתח Claude נפרד: `ISPORT_ANTHROPIC_API_KEY`.
- סרטוני הדרכה ב-`isport/tutorials` (אותו נוהל כמו mat-kon: נועה + מוזיקה, `isport-voice.yml`). **לא להקליט מחדש בלי לשאול**: אחרי שינוי במסך – לשאול את המשתמש אם לעדכן את הסרטונים.

### קורס ערוץ מוזיקה מסונו (`suno_course/`)
- תיאור: `suno_course/README.md`. תוכן אחד ב-`src/` ושתי גרסאות: Artifact ב-claude.ai (`build.sh`, לפרסם מחדש לאותה כתובת) ואפליקציה
  `web` → https://suno-course.pages.dev + `api` → Worker `suno-course-api` (AI עם סיסמה). עלייה: `suno-course.yml` אחרי מיזוג ל-main.
- בדיקה: `cd suno_course/api && npm test` · `cd suno_course/web && npm test`. אותם כללים: טלפון + מחשב + מצב לילה.
- כל נתון "קשה" (מחיר, סף, מכסה) עם מקור ותאריך; איורי מסכים מסומנים כאיור ולא כצילום.

### מורה לנגינה – סימולטור (`music_teacher/`)
- תיאור: `music_teacher/README.md`; תוכנית ועלויות: `music_teacher/IDEAS.md`. אפליקציה מסחרית ללימוד גיטרה לבד (קלאסית / חשמלית), מורה וידיים בתלת־ממד (Three.js).
- `music_teacher/web` → Pages `music-teacher` (בלי שרת). עלייה: `music-teacher.yml` אחרי מיזוג ל-main. הסקיצה הישנה: `sketch/lesson1.html` (Artifact).
- בדיקה: `cd music_teacher/web && npm test && npm run build`. אותם כללים: טלפון + מחשב + מצב לילה, `useEffect` עם סוגריים.
- **תמיד למזג לבד** את ה-PR (אחרי שהבדיקות ירוקות) ולעקוב שהעלייה (`music-teacher.yml` על main) הצליחה – ולדווח עם הקישור.
- המורה מודול נפרד (`src/three/teacher.js`) כדי שאפשר יהיה להחליף בדמות קנויה. זיהוי צליל בטיונר: `src/lib/pitch.js` (פונקציה טהורה + בדיקות).

### מילים באנגלית (`english_words/`)
- תיאור: `english_words/README.md`. תרגול 35 מילים לילדים: קוראים בקול (מיקרופון) ובוחרים תרגום מ-4; 80% כדי לעבור לשלב משפטים.
- `english_words/web/public` (HTML+JS בלי בנייה) → https://english-words.pages.dev. עלייה: `english-words.yml` אחרי מיזוג ל-main.
- בדיקה: `cd english_words/web && npm test`. טלפון + מחשב + מצב לילה.

### טוטו (`toto_predictor/`)
- תיאור: `toto_predictor/README.md`. רץ בהפעלה ידנית (`toto-weekly.yml`), האתר ב-GitHub Pages (`pages-deploy.yml`).

### חשבוניות סקאלה (`scala_invoices/`)
- תיאור: `scala_invoices/README.md`. רץ פעם בחודש (`scala-invoices.yml`).
