---
name: motion-graphics
description: >-
  Showreel-style motion graphics - kinetic animated Hebrew/English titles that slide and scale in, sub-title
  pills, glowing blue HUD, xfade transitions between clips, dark tech background when no clips are given.
  Rendered from HTML/CSS/JS with Playwright and composited with ffmpeg; vertical 1080x1920 by default.
  Use when the user says /motion-graphics, "showreel", "kinetic typography", "animated titles",
  "גרפיקת תנועה", "שואוריל", "כותרות מונפשות", "אנימציית טקסט", "תעשה לי סרטון עם כותרות", "אינטרו".
---

# motion-graphics

סרטון בסגנון שואוריל: כותרות גדולות שנכנסות בתנועה, מעברים בין קליפים, מסגרת טכנולוגית עם זוהר כחול.

## מה לעשות
1. מצא את הקבצים שצורפו: `ls -t /root/.claude/uploads/*/*` (קליפים – לא חובה; אפשר גם בלי).
2. קח מהמשתמשת את שורות הטקסט (כל שורה = סצנה). אם לא נתנה – הצע 3 שורות קצרות לפי הנושא (עד 5 מילים כל אחת).
   `"כותרת | משנה"` – מה שאחרי הקו האנכי יוצג כתג משנה שנכנס מהצד.
3. הרץ (לוקח כ-30–60 שניות):
```bash
mkdir -p /tmp/video-out
python3 /home/user/red-grass/.claude/skills/motion-graphics/make.py [CLIP1.mp4 CLIP2.mp4 ...] --lines "שורה 1" "שורה 2 | משנה" "שורה 3" --out /tmp/video-out/showreel.mp4
```
   אפשרויות: `--accent "#19a8ff"` (צבע הדגשה) · `--format 9:16|16:9|1:1` · `--scene-seconds 3` (אורך סצנה)
   · `--title-card` (הסצנה הראשונה על רקע טכנולוגי בלי קליפ) · `--music שיר.mp3` (במקום הצליל המקורי של הקליפים).
   מספר הסצנות = המקסימום בין מספר השורות למספר הקליפים (קליפים חוזרים בסבב אם יש יותר שורות).
4. שלח את שורת `OUTPUT:` עם `SendUserFile` (`display: "render"`).
5. ענה בעברית פשוטה וקצרה, והציע לשנות צבע / אורך / טקסט.

## מגבלות
- טקסטים ארוכים מאוד קטנים אוטומטית; עדיף שורות קצרות. הפונט: Rubik (בתיקיית `video-tools/fonts`).
- הכותרות ממוקמות במרכז/למטה – אם הדמות בקליפ במרכז, הכותרת תכסה חלק ממנה.
