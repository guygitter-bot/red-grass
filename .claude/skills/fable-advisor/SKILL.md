---
name: fable-advisor
description: How we work with Claude Fable 5.2 - the "executor + advisor" method. Sonnet 5.5 (or the session's model) does the actual work; Fable 5.2 is consulted as an advisor at the decisive moments (before committing to an approach, when stuck, before declaring done). Use when setting up any Claude-powered bot, workflow or session in this repo, when the user says /fable-advisor, "יועץ", "advisor", "פייבל", "Fable", "שהמודלים ידברו ביניהם", "לחסוך בטוקנים", or when choosing which model runs a task.
---

# Fable כיועץ – שיטת העבודה שלנו

המקור: סרטון הדרכה (Automator-il) על פקודת `/advisor` של Claude Code. הרעיון:
Fable 5.2 הוא המודל החזק ביותר, אבל גם היקר ביותר ($8 / $40 למיליון טוקנים, פי 4 מ-Sonnet 5.5).
להריץ איתו כל משימה זה "כמו לקנות פרארי ולנסוע איתה למכולת". במקום זה:

- **Sonnet 5.5 הוא המבצע** (executor) – קורא קבצים, כותב, מריץ בדיקות, עונה. רוב הטוקנים עוברים דרכו.
- **Fable 5.2 הוא היועץ** (advisor) – רואה את כל השיחה, ונותן תוכנית / תיקון כיוון ברגעים החשובים בלבד.
- לפי Anthropic: חיסכון של **עד 37% בטוקנים** כמעט בלי לאבד איכות.

## מתי המבצע פונה ליועץ (הכלל לכל בוט ולכל שיחה)
1. **לפני עבודה של ממש** – אחרי התמצאות (לקרוא קבצים, להבין מה יש), ולפני שכותבים / משנים / מתחייבים לפרשנות.
2. **כשנתקעים** – שגיאה שחוזרת, גישה שלא מתכנסת, תוצאה שלא מסתדרת.
3. **לפני שמשנים כיוון**.
4. **לפני שמכריזים "סיימתי"** – קודם לשמור את התוצאה (קובץ, שמירה), ואז לבקש ביקורת.
- במשימה קצרה ופשוטה (תשובה, שינוי טקסט) – לא צריך יועץ. הערך העיקרי הוא בפנייה הראשונה, לפני שהגישה מתקבעת.
- ליחס לעצה משקל רציני. אם יש ראיה ישירה שסותרת (הקובץ אומר X) – לא להחליף כיוון בשקט, אלא לשאול את היועץ שוב:
  "מצאתי X, הצעת Y – מה מכריע?".

## איך זה מחובר אצלנו

### 1. שיחות Claude Code (כאן, בצ'אט)
- `.claude/settings.json`: `"advisorModel": "claude-fable-5-2"` – בכל שיחה במאגר Fable הוא היועץ.
- המודל הראשי: מומלץ **Sonnet** (`/model sonnet`); לשינוי היועץ / כיבוי: `/advisor`.
- עבודה שמועברת ל-subagent – לפי "חיסכון במכסה" ב-CLAUDE.md (Haiku לשינוי קטן, Sonnet לבינוני).

### 2. בוטים שמריצים Claude Code ב-GitHub Actions
(`bis-fix`, `budget-fix`, `mat-kon-fix`, `tsevet-dev`, `tsevet-smartedit`, `seder-requests`)
- מבצע: `--model claude-sonnet-5-5`, יועץ: `--advisor claude-fable-5-2`.
- אפשר לשנות בלי קוד, במשתני GitHub (`vars`): `<APP>_MODEL` למבצע ו-`<APP>_ADVISOR` ליועץ
  (`off` = בלי יועץ; נשלח כ-`--settings {"advisorModel":""}` כי אחרת ההגדרה של המאגר מחזירה אותו).
- `seder-requests` (claude-code-action): היועץ מגיע מ-`.claude/settings.json`; `SEDER_MODEL` / `SEDER_ADVISOR=off` כמו בשאר.

### 3. בוטים שקוראים ל-API ישירות ("צוות" – `tsevet/api/agents.js`)
כלי בצד השרת של Anthropic (beta):
```js
await client.beta.messages.create({
  model: 'claude-sonnet-5-5',                       // המבצע
  betas: ['advisor-tool-2026-03-01', /* ... */],
  tools: [{ type: 'advisor_20260301', name: 'advisor', model: 'claude-fable-5-2', max_uses: 2,
            caching: { type: 'ephemeral', ttl: '5m' } }, /* ... */],
  ...
});
```
חשוב:
- **התאמת זוגות:** היועץ חייב להיות חזק לפחות כמו המבצע. Fable 5.2 מתאים לכל מבצע (Haiku 5.5, Sonnet 5.5, Opus 5.5).
  מבצע Fable 5.2 מקבל רק יועץ Fable 5.2 / Mythos 5.2 – אז אין טעם ביועץ.
- **אי אפשר לכפות** את הקריאה ליועץ (`tool_choice` כפוי מחזיר 400) – מכוונים מהנחיות המערכת (הכלל למעלה).
- **העצה מוצפנת** (`advisor_redacted_result`) – לא קוראים אותה, רק מחזירים את `response.content` כמו שהוא בתור הבא.
- לא לשנות / להסיר את כלי היועץ באמצע שיחה (זה שובר את ה-thinking השמור → 400). רק בשיחה חדשה.
- **עלות:** הטוקנים של היועץ מגיעים ב-`usage.iterations` (סוג `advisor_message`, עם `model`) – לתמחר לפי מחיר Fable.
- **עלות אמיתית:** היועץ חוסך רק לעומת עבודה עם Fable כמודל הראשי. להוסיף יועץ לבוט שרץ על Opus / Sonnet – מוסיף עלות,
  ולכן אצלנו המבצע עבר ל-Sonnet, והיועץ מונחה לפנות רק במשימה של כמה צעדים.
- אם החשבון לא מאפשר Fable (שגיאה 400) – הבוט ממשיך בלי יועץ (`advisorOff` ב-`agents.js`).
- `max_uses` מגביל כמה פעמים בתור אחד (אצלנו 2). שגיאה (`max_uses_exceeded`, `overloaded`) לא מפילה את התור – המבצע ממשיך לבד.

### 4. Managed Agents (אם נשתמש)
יועץ מוגדר בסוכן עצמו: `multiagent.advisor = { type: 'enabled', model: 'claude-fable-5-2' }`.

## כשמוסיפים בוט / workflow / אפליקציה חדשה עם Claude
- בוט שעובד בכמה צעדים (כלים, קוד, תוכניות) – מבצע Sonnet 5.5 + יועץ Fable 5.2, עם הכלל "מתי פונים ליועץ".
- קריאה בודדת פשוטה (סיווג, תרגום, תיקון כתיב) – בלי יועץ, המודל הזול שמספיק.
- לרשום את העלות של היועץ במסך העלויות של האפליקציה.
