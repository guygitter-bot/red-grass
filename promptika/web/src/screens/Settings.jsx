// הגדרות: המחיר ללקוח קבוע, אז אין כאן תמחור (הנתונים בשרת נשארים לעתיד). נשארים רק יציאה ומצב לילה.
import { api, setToken } from '../lib/api';
import { Button, Card } from '../components/ui';

export default function Settings({ onLogout }) {
  async function logout() {
    await api('POST', '/logout', {}).catch(() => {});
    setToken('');
    onLogout();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">הגדרות</h1>
      <Card>
        <h2 className="font-bold">המחיר ללקוח קבוע</h2>
        <p className="mt-1 text-sm text-muted">הצעות מחיר יתווספו בעתיד. כרגע האפליקציה עוזרת להחליט אילו מערכות לבנות.</p>
      </Card>
      <p className="text-sm text-muted">מצב יום / לילה – הכפתור בראש המסך.</p>
      <Button kind="ghost" onClick={logout}>יציאה מהמכשיר הזה</Button>
    </div>
  );
}
