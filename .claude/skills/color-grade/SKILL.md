---
name: color-grade
description: >-
  Cinematic, consistent color grading for one or more video clips - auto exposure and contrast
  normalization per clip, then a look preset (cinematic teal-orange, warm, clean, bw), light vignette
  and mild sharpen; audio is kept. Use when the user attaches a video and says /color-grade, "color grade",
  "make it cinematic", "תן לזה צבעוניות", "צבעוניות קולנועית", "קולור גריידינג", "שפר צבעים",
  "שחור לבן", "לוק קולנועי", "תעשה שכל הקליפים ייראו אותו דבר".
---

# color-grade

צבעוניות קולנועית ואחידה לסרטון (או כמה סרטונים – כולם יוצאים עם אותו לוק).

## מה לעשות
1. מצא את הקבצים שצורפו: `ls -t /root/.claude/uploads/*/*` (סרטונים .mp4/.mov). אם צורפו כמה – קח את כולם.
2. אל תשאל כלום אלא אם אין סרטון בכלל. בחירת preset לפי הבקשה:
   - ברירת מחדל / "קולנועי" → `cinematic` (טורקיז-כתום)
   - "חם" / "שמש" → `warm` · "נקי" / "טבעי" → `clean` · "שחור לבן" → `bw`
3. הרץ (תיקיית הפלט כבר מוכנה למשתמשת):
```bash
mkdir -p /tmp/video-out
python3 /home/user/red-grass/.claude/skills/color-grade/grade.py CLIP1.mp4 [CLIP2.mp4 ...] --preset cinematic --out /tmp/video-out
```
   אפשרויות: `--strength 0.6` (לוק עדין) עד `1.4` (חזק יותר).
4. הסקריפט מדפיס שורות `OUTPUT: <נתיב>`. שלח כל קובץ למשתמשת עם `SendUserFile` (`display: "render"`).
5. אם רוצים השוואה – הפנה ל-`/before-and-after`.
6. ענה **בעברית פשוטה וקצרה**: מה עשית (איזה לוק) ואיך לבקש שינוי ("חם יותר", "שחור לבן", "פחות חזק").

## מגבלות
- הרזולוציה מוקטנת עד 1080 בצד הארוך. האודיו נשמר.
- הלוק מחושב אוטומטית לפי בהירות הקליפ; אם יצא חזק/חלש מדי – `--strength`.
