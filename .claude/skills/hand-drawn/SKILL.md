---
name: hand-drawn
description: >-
  Turn a video or a photo into a hand-drawn whiteboard / pencil-sketch look (black lines on paper) with a
  progressive "being drawn" reveal in the first ~2 seconds and an optional Hebrew title that writes itself on.
  Audio is kept. Use when the user says /hand-drawn, "sketch", "whiteboard", "pencil drawing",
  "ציור ביד", "סקיצה", "לוח לבן", "רישום", "תהפוך לציור", "שרטוט", "כאילו מצויר".
---

# hand-drawn

הופך סרטון או תמונה לרישום בעיפרון על נייר, שמצטייר בהדרגה, עם כותרת בעברית שנכתבת.

## מה לעשות
1. מצא את הקובץ שצורף: `ls -t /root/.claude/uploads/*/*` (סרטון או תמונה).
2. אל תשאל כלום. אם המשתמשת ביקשה כותרת / טקסט – העבר ב-`--title` (עברית תקינה, שורה קצרה; עד כ-5 מילים).
3. הרץ:
```bash
mkdir -p /tmp/video-out
python3 /home/user/red-grass/.claude/skills/hand-drawn/sketch.py INPUT --title "הכותרת" --out /tmp/video-out
```
   אפשרויות: `--reveal 2.0` (משך ה"ציור" בשניות) · `--detail 0.7` (קווים עבים יותר) או `1.5` (דקים ומפורטים)
   · `--seconds 6` (לתמונה: אורך הסרטון; לסרטון: לקצר).
4. שלח את שורת `OUTPUT:` עם `SendUserFile` (`display: "render"`).
5. ענה בעברית פשוטה וקצרה, והציעי "קווים עבים/דקים יותר" או "בלי כותרת".

## מגבלות
- סרטון עמוס פרטים/מוקטן באיכות נמוכה ייתן רעש בקווים; `--detail 0.7` מרגיע.
- האנימציה של "הציור" היא חשיפה בהדרגה מלמעלה למטה (לא יד שמציירת קו אחרי קו).
- הכותרת בפונט Rubik (לא כתב יד).
