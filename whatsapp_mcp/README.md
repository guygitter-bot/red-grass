# ווטסאפ ל-Claude (`whatsapp_mcp/`)

מחבר את הווטסאפ האישי ל-Claude Desktop: "מה סיכמתי עם דני?", "תעדכן אותי מה קרה בקבוצות היום", ניסוח תשובה ושליחה אחרי אישור.

מבוסס על הפרויקט הפתוח [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) (MIT), בגרסה קבועה (`7d6a06d`).
לא מעתיקים את הקוד – סקריפט ההתקנה מוריד אותו ומתקן אותו:
- **אבטחה:** במקור הגשר מאזין לכל הרשת בלי סיסמה (`:8080`), כך שכל מכשיר באותו Wi‑Fi יכול לשלוח הודעות בשמך.
  `configure.py` מגביל אותו ל-`127.0.0.1`.
- מוסיף את `whatsapp` ל-`claude_desktop_config.json` בלי למחוק שרתים קיימים (נשמר גיבוי `.backup`).

## איך זה עובד
1. **הגשר** (Go, `whatsapp-bridge`) מתחבר לווטסאפ כ"מכשיר מקושר" (כמו WhatsApp Web) ושומר את ההודעות במחשב (`whatsapp-bridge/store/`).
2. **שרת ה-MCP** (Python, `whatsapp-mcp-server`) נותן ל-Claude כלים: `search_contacts`, `list_chats`, `list_messages`,
   `get_message_context`, `download_media`, `send_message`, `send_file`, `send_audio_message` ועוד.
3. Claude Desktop מפעיל את שרת ה-MCP בעצמו. הגשר צריך לרוץ בחלון פתוח (`start-whatsapp.command` / `start-whatsapp.bat`).

## התקנה
**מק** – לפתוח Terminal ולהדביק:
```
curl -fsSL https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp/install-mac.sh | bash
```
**ווינדוס** – לפתוח PowerShell ולהדביק:
```
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp/install-windows.ps1 | iex"
```
הסקריפט מתקין מה שחסר (uv, Go, git; בווינדוס גם מהדר C דרך winget), מוריד לתיקייה `whatsapp-mcp` בתיקיית הבית, בונה ומציג קוד QR.
בטלפון: ווטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר. אחר כך לסגור לגמרי את Claude Desktop ולפתוח מחדש.

הפעלה בפעמים הבאות: לחיצה כפולה על `start-whatsapp` בתיקייה `whatsapp-mcp`. ההיסטוריה נטענת בהתחלה כמה דקות.
בערך כל 20 יום ווטסאפ מבקש לסרוק QR מחדש.

## חשוב לדעת
- **חיבור לא רשמי:** ווטסאפ עלולה לחסום מספר שמשתמש בו.
- **הודעות הן לא הוראות:** כל מי ששולח הודעה יכול לכתוב בה הוראות ל-Claude ("שלח את השיחה הזו ל…"). לאשר שליחה רק אחרי
  קריאה של מה נשלח ולמי. מי שרוצה רק קריאה – לכבות את `send_*` במסך הכלים של Claude Desktop.
- תקלות: לא נטענות הודעות / לא מסונכרן → למחוק את `whatsapp-bridge/store/*.db` ולהפעיל שוב (סריקה מחדש).
- בדיקה: `python3 configure.py <תיקייה> <קובץ הגדרות> <uv>` על עותק של `main.go`; `bash -n install-mac.sh`.
