---
name: beats-and-cuts
description: >-
  Cut video clips to the beat of a music track - detects tempo and beats (pure numpy), jumps between
  segments of the clips on beats, optional zoom punch on strong beats, vertical 1080x1920 by default,
  music as soundtrack with fade-out. Use when the user attaches video(s) plus a song and says
  /beats-and-cuts, "cut to the beat", "edit to the music", "חיתוכים על הביט", "תחתוך לפי המוזיקה",
  "עריכה לפי קצב", "ריל על הביט", "קליפ מהיר עם מוזיקה".
---

# beats-and-cuts

עריכה שחותכת בין קטעים על הקצב של המוזיקה (כמו ריל עם מוזיקה).

## מה לעשות
1. מצא קבצים שצורפו: `ls -t /root/.claude/uploads/*/*`. סרטונים = .mp4/.mov; מוזיקה = .mp3/.m4a/.wav (או קובץ וידאו שהמשתמשת אמרה שממנו לקחת את הצליל).
2. אל תשאל כלום אלא אם חסר משהו חיוני. אם אין קובץ מוזיקה – הסקריפט משתמש באודיו של הסרטון הראשון.
   אם המשתמשת ביקשה שיר ספציפי שלא צורף – אמרי לה לצרף קובץ (לא להוריד שירים מהרשת).
3. הרץ:
```bash
mkdir -p /tmp/video-out
python3 /home/user/red-grass/.claude/skills/beats-and-cuts/beats.py CLIP1.mp4 [CLIP2.mp4 ...] --music SONG.mp3 --out /tmp/video-out
```
   אפשרויות: `--format 9:16` (ברירת מחדל, גם 16:9 / 1:1 / 4:5) · `--every 1|2|4|8` (חיתוך כל כמה ביטים; ברירת מחדל לפי הטמפו)
   · `--seconds 20` (ברירת מחדל: אורך השיר עד 30 שניות) · `--music-start 45` (להתחיל מהשנייה 45 בשיר, למשל הפזמון)
   · `--no-punch` (בלי זום על הביט) · `--bpm 128` (אם הזיהוי טעה).
4. בדוק בשורת "טמפו מזוהה" שהמספר הגיוני (שירים בדרך כלל 80–160). אם נראה כפול/חצי – הרץ שוב עם `--bpm`.
5. שלח את שורת `OUTPUT:` עם `SendUserFile` (`display: "render"`).
6. ענה בעברית פשוטה וקצרה: איזה טמפו זוהה, כמה קטעים, ואיך לבקש "יותר מהיר / איטי / מהפזמון".

## מגבלות
- חיתוך לפי קצב קבוע (לא מזהה פזמון/בית). קטעים נלקחים ברצף מכל קליפ ובסבב בין הקליפים.
- מוזיקה עם קצב לא יציב עלולה לצאת פחות מדויקת.
