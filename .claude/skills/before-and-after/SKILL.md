---
name: before-and-after
description: >-
  Build a before/after comparison video - animated wipe divider with a glowing line, pill badges
  "לפני"/"אחרי", or side-by-side / stacked layouts. Give it two videos, or one video and it compares the
  original against an automatic color-graded version. Audio comes from the "after" clip. Use when the user
  says /before-and-after, "before and after", "לפני ואחרי", "השוואה", "תראה לי את ההבדל", "וי-דיווידר",
  "מסך מפוצל", or attaches an original and an edited video.
---

# before-and-after

סרטון השוואה "לפני / אחרי" עם קו שנע על המסך ותגיות.

## מה לעשות
1. מצא קבצים שצורפו: `ls -t /root/.claude/uploads/*/*`.
   - שני סרטונים: הראשון (הישן בזמן) = לפני, השני = אחרי. אם לא ברור – שאל משפט אחד.
   - סרטון אחד: הסקריפט יוצר לבד גרסה עם צבעוניות (סקיל `color-grade`) ומשווה אליה.
2. בחר מצב: `wipe` (ברירת מחדל, קו נע) · `side` (צד לצד) · `stack` (מעלה-מטה, מתאים לסרטון אנכי).
3. הרץ:
```bash
mkdir -p /tmp/video-out
python3 /home/user/red-grass/.claude/skills/before-and-after/compare.py BEFORE.mp4 [AFTER.mp4] --mode wipe --out /tmp/video-out
```
   אפשרויות: `--preset cinematic|warm|clean|bw` (לסרטון יחיד) · `--seconds 12` (ברירת מחדל עד 20 שניות)
   · `--before-label "לפני"` / `--after-label "אחרי"` (להחליף טקסט התגיות).
4. שלח את שורת `OUTPUT:` עם `SendUserFile` (`display: "render"`).
5. ענה בעברית פשוטה וקצרה (איזה מצב, מה מושווה, ואפשר לבקש מצב אחר).

## הערות
- "לפני" מימין ו"אחרי" משמאל (כיוון קריאה בעברית). הקו נע משמאל לימין ומגלה בהדרגה את ה"אחרי".
- האודיו מגיע מקליפ ה"אחרי". אורך הפלט = הקצר מבין השניים.
