# הסדרה – אבא נגד הבן ב-2K

סדרת פלייאוף (הטוב מ-7) ב-NBA 2K27: לייקרס 2010 נגד ספרס 2010. אחרי כל משחק לוחצים מי ניצח (ואם רוצים – גם התוצאה),
והלוח נראה כמו גרפיקת סדרה בטלוויזיה. מתעדכן אוטומטית בכל המכשירים.

- האפליקציה: https://sidra-2k.pages.dev (אפשר להתקין למסך הבית – PWA)
- `web/` – React + Vite + Tailwind. החישובים ב-`src/lib/series.js` (פונקציות טהורות + בדיקות). הסמלים ב-`src/components/Logo.jsx` – ציור משלנו בצבעי הקבוצות, לא הלוגו הרשמי.
- `api/` – Cloudflare Worker `sidra-2k-api` + Durable Object `Series` אחד. בלי סיסמה (אפליקציה משפחתית); מקבל בקשות רק מהאתר.
  כל שינוי הוא פעולה קטנה עם מספר המשחק, כך ששני מכשירים שלוחצים יחד לא רושמים משחק פעמיים.
- סדר הבית 2-2-1-1-1, יתרון ביתיות ללוס אנג'לס (`HOME` – זהה ב-`web/src/lib/series.js`; הכללים בשרת ב-`api/series.js`).

## בדיקה
- `cd api && npm test` · `cd web && npm test && npm run build`
- מקומית: `node api/dev.mjs` (שרת בזיכרון על 8787) ו-`VITE_API_URL=http://localhost:8787 npm run build && npx vite preview --port 4173`

## עלייה
`.github/workflows/sidra-2k.yml` אחרי מיזוג ל-main. צריך רק את הסודות `CLOUDFLARE_API_TOKEN` ו-`CLOUDFLARE_ACCOUNT_ID` (קיימים במאגר).
