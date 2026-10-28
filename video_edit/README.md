# עריכת סרטוני הופעות ("The guys")

תבנית לעריכת סרטון אנכי: כיתובים מונפשים מעל האצבע, כותרת, זום קל וצליל "ווש" בכל כיתוב, וסיכום בסוף.

- `overlay.html` – הכיתובים והעיצוב. הזמנים בשניות ב-`SEG`, והמיקום ב-`style` של כל בלוק.
- `render.cjs` – מצלם את הכיתובים לתמונות שקופות (Playwright, 30 פריימים לשנייה, 1080x1920).
  `node render.cjs <נתיב מלא ל-overlay.html> <תיקיית פלט> [test|full]`
- פונטים (google/fonts ב-raw.githubusercontent.com, אל `~/.fonts`): Karantina Bold, Rubik, Fredoka.
- הורדה מ-Drive: `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`
  (צריך את `drive.google.com` ו-`drive.usercontent.google.com` ברשימת הדומיינים של הסביבה).
- הרכבה ב-ffmpeg: הגדלה ל-1080x1920 עם זום לפי זמני הכיתובים (`scale` עם `eval=frame`, חיתוך מלמעלה),
  `overlay` של רצף התמונות (פריימים ריקים = קישור לתמונה שקופה אחת), וצליל ווש (`anoisesrc` מסונן) עם `adelay` לכל כיתוב.
