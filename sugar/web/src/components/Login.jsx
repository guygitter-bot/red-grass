// מסך פתיחה בפעם הראשונה במכשיר: רק "השם שלי" (לא חובה). בלי סיסמה – כל מי שפותח את האפליקציה רואה את אותו יומן.
// השם נשמר רק במכשיר ונרשם ליד כל ארוחה והודעה, כדי לדעת מי רשם.
import { useState } from 'react';
import { Droplet } from 'lucide-react';
import { getMe, setMe } from '../lib/me';
import { Button, inputCls } from './ui';

export default function Login({ onDone }) {
  const [name, setName] = useState(getMe());
  const submit = (e) => {
    e.preventDefault();
    setMe(name);
    onDone();
  };
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="rounded-2xl bg-soft p-3 text-accent-ink">
            <Droplet size={32} />
          </span>
          <h1 className="text-2xl font-bold">יומן סוכר</h1>
          <p className="text-sm text-muted">איך לקרוא לך? השם יופיע ליד מה שתרשמו, כדי שכולם יידעו מי רשם.</p>
        </div>
        <input className={`${inputCls} mb-3`} placeholder="למשל: אמא, סבתא רינה" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="nickname" />
        <Button className="w-full">כניסה</Button>
      </form>
    </div>
  );
}
