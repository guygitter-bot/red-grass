---
name: mystery-video-engine
description: >-
  Integrate an automatic mystery-shopper (customer-experience audit) video editor into an existing system:
  the system sends raw hidden-camera footage, its own transcript and the audit report, the user marks
  must-include ranges on a timeline, and the engine (Claude plans, code enforces, ffmpeg renders) returns a
  7-8 minute edited film with store entry and exit, rep-only Hebrew subtitles, two groups of keep/improve
  cards, an opening slide and a summary screen. Use when wiring this engine into an app or backend, adding
  the timeline / must-include feature, changing the edit rules, or when the user says "mystery-video-engine",
  "מנוע עריכה", "לחבר את העריכה למערכת", "עריכה אוטומטית של סרטוני ביקורת", "טיימליין".
---

# mystery-video-engine – חיבור העריכה למערכת קיימת

קרא קודם את `README.md` שליד הקובץ הזה: מבנה, הקלט (`job.json`), הפלט, הטיימליין, התקנה.

## העיקרון
- **Claude מחליט, הקוד אוכף, ffmpeg בונה.** את הכללים הקשיחים (קטעי חובה, אורך, קבוצות כרטיסים, כתוביות רק לנציג/ה)
  לא משאירים להנחיות בלבד – הם ב-`engine/validate.py`, עם בדיקות ב-`tests/test_validate.py`. כלל חדש → לשם + בדיקה.
- **התמלול של המערכת עדיף** על Whisper (מהיר, ובדרך כלל עם תוויות דוברים). Whisper רק כגיבוי.
- כל זמן הוא **בשניות מתחילת חומר הגלם** – גם בטיימליין, גם בתוכנית, גם בכתוביות.

## חיבור למערכת – הסדר המומלץ
1. **לברר את מבנה המערכת** (לשאול את המשתמש אם לא ברור מהקוד):
   - באיזה פורמט התמלול? יש זמנים לכל משפט? יש תוויות דוברים, ומי הנציג/ה?
   - איפה אפשר להריץ ffmpeg + Python (שרת / קונטיינר / תור משימות)? לא בפונקציית serverless קצרה.
   - איזה מפתח Claude יש (`ANTHROPIC_API_KEY` כסוד בשרת, לעולם לא בקוד)?
2. **מתאם תמלול:** פונקציה קטנה שממירה את התמלול של המערכת ל-`[{start, end, text, speaker}]`, ומעבירה ב-`rep_speaker` את הדובר שהוא הנציג/ה.
   הכתוביות תמיד רק לנציג/ה. אם המערכת יכולה לשלוח רק את הנציג/ה – `transcript_rep_only: true`; עדיף שני הדוברים מסומנים (הקשר לבחירת הרגעים).
   אם התמלול נעשה מקובץ קול נפרד (MP3) ולא מהסרטון עצמו – לוודא שהזמנים תואמים לסרטון; אם לא, `transcript_offset`.
3. **משימה ברקע:** כתיבת `job.json` → `python3 engine/run.py job.json OUT_DIR` → קריאת `result.json` → הודעה למשתמש.
   קודם להריץ עם `--dry-run` (בונה את הבקשה ל-Claude בלי לשלוח) ולבדוק את `request_preview.json`.
4. **טיימליין במסך:** `thumbs.timeline_sprite` לפס התמונות; סימון טווחים → `must_include`; סמנים אופציונליים → `markers`.
   אחרי העריכה – להציג את `render_plan.json` (מה נבחר) ואת `warnings` מ-`result.json`.
5. **עריכה חוזרת בלי Claude:** המשתמש משנה בטיימליין → שומרים כ-raw plan → `run.py ... --plan file.json` (חוסך זמן וכסף).

## לא לשבור
- פלט `yuv420p` (אחרת לא מתנגן בטלפונים). עברית רק דרך `text_he.text_png` (Pillow + libraqm) – לא `drawtext` של ffmpeg.
- המודל `claude-opus-5-5` דוחה `tool_choice` כפוי (400) – לכן structured outputs (`output_config.format`), כמו ב-`planner.py`.
- כתוביות: רק מה שהנציג/ה אמר/ה, מהתמלול, בלי ניסוח מחדש. בספק – בלי כתובית.
- סרטונים, תמלולים ודוחות אמיתיים לא נכנסים למאגר קוד או ללוגים ציבוריים (פנים, שמות, טלפונים).
