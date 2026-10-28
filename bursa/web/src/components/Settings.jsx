// הגדרות: מצב לילה, התראות, יציאה ו"על האפליקציה"
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { DISCLAIMER } from '../lib/guide';
import { getTheme, setTheme } from '../lib/theme';
import { PushCard } from './Alerts';
import { Button, Card, SectionTitle, Tabs } from './ui';

export default function Settings() {
  const [theme, setT] = useState(getTheme());
  const pick = (t) => {
    setTheme(t);
    setT(t);
  };
  const logout = async () => {
    try {
      await api('/logout');
    } catch {
      // גם אם השרת לא ענה – יוצאים מהמכשיר הזה
    }
    setToken('');
    window.dispatchEvent(new Event('bursa-logout'));
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">הגדרות</h1>
      <div>
        <SectionTitle>מראה</SectionTitle>
        <Tabs tabs={[['auto', 'לפי המכשיר'], ['light', 'יום'], ['dark', 'לילה']]} value={theme} onChange={pick} />
      </div>
      <PushCard />
      <Card>
        <h3 className="font-bold">על האפליקציה</h3>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
          <p>הנתונים מגיעים מ-Yahoo Finance. בחלק מהבורסות הם מתעכבים עד 15-20 דקות.</p>
          <p>הציון נבנה מכללים מוכרים: מגמה (ממוצעים נעים), מומנטום, RSI, MACD ורצועות בולינגר. התחזית היא טווח סביר לפי התנודתיות של המניה בעבר, ולא ניבוי.</p>
          <p>השרת סורק מניות ברקע וישלח התראה כשיש אות, גם כשהאפליקציה סגורה.</p>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </Card>
      <Button variant="danger" onClick={logout}><LogOut size={16} /> יציאה מהחשבון</Button>
    </div>
  );
}
