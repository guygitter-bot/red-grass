# Kidzfinder (`kidzfinder/`)

אפליקציית מעקב הורי לאנדרואיד: ההורה רואה את הילד/ה על מפה חיה, מקבל התראה כשהילד מגיע או יוצא
ממקום (בית ספר, בית), והילד יכול ללחוץ SOS. **שקוף לחלוטין** – הילד יודע שהמיקום משותף, ואין בה האזנת סתר.

- אתר ההורה: https://kidzfinder.pages.dev · השרת: Worker `kidzfinder-api`.
- עלייה: `.github/workflows/kidzfinder.yml` אחרי מיזוג ל-main (יתווסף). אפליקציית הילד (אנדרואיד): APK להורדה מהאתר.

## מבנה
- `api/` – שרת (Cloudflare Worker + Durable Object `Family`, אחד לכל משפחה):
  - `worker.js` – רק מסדר כתובות ו-CORS.
  - `src/family.js` – הלוגיקה: חיבור בקוד, מיקום חי, גדרות וירטואליות, SOS, סוללה, פקודות.
  - `src/geo.js` – חישובי מרחק וגדרות (פונקציות טהורות + בדיקות).
- `web/` – אתר ההורה (React + Vite + Tailwind): מפה חיה (Leaflet + OpenStreetMap), כרטיס לכל ילד, בדיקת "אתה בסדר?", צלצול, התקשרות והתראות. יש **מצב הדגמה** (ילד שזז על המפה) לבדיקה בלי טלפון.
- `mobile/` – אפליקציית הילד (Capacitor, מיקום ברקע). *(בבנייה)*

## עקרונות (ראו `GAP-REPORT.md`)
- הילד יודע שהמיקום משותף; הודעה קבועה בטלפון שלו. אין מצב מוסתר.
- **אין האזנת סתר לסביבה.** במקום זה: כפתור "תתקשרי אליי" (שיחה רגילה, הילד רואה) וצלצול חזק.
- שומרים מינימום: המיקום האחרון וכמה מקומות, לא תיק מעקב.

## השרת – כתובות עיקריות
- `POST /api/family/create` → `{ familyId, parentToken }` (הורה ראשון).
- `POST /api/family/:id/pair-code` (הורה) → קוד 6 ספרות, תקף 10 דק׳.
- `POST /api/family/:id/pair` `{ code, childName }` → `{ childId, childToken }`.
- `POST /api/family/:id/loc` (ילד) `{ lat, lng, acc, battery }`.
- `POST /api/family/:id/sos` (ילד).
- `POST /api/family/:id/places` (הורה) – מקום/גדר וירטואלית.
- `POST /api/family/:id/command` (הורה) `{ childId, action: 'ring'|'call' }`.
- `GET  /api/family/:id/state` (הורה) – מיקומים חיים, מקומות, התראות.

## בדיקה
- `cd kidzfinder/api && npm test` · `cd kidzfinder/web && npx vitest run && npm run build`
