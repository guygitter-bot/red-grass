// התראות: הרשימה, הפעלת התראות לטלפון והגדרות איזה התראות לקבל
import { useCallback, useEffect, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { toast } from '../lib/hooks';
import { enableNotifications, isSubscribed, notifyState } from '../lib/push';
import { stockLink } from '../lib/route';
import { Button, Card, Empty, ErrorBox, Num, SectionTitle, Spinner, Toggle } from './ui';

export function PushCard() {
  const [state, setState] = useState(notifyState());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isSubscribed().then(setSubscribed);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      await enableNotifications();
      setSubscribed(true);
      toast('ההתראות הופעלו במכשיר הזה');
    } catch (e) {
      toast(e.message);
    } finally {
      setState(notifyState());
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await api('/push/test');
      toast(r.sent ? 'נשלחה התראת ניסיון' : 'אין מכשיר רשום להתראות. הפעילו קודם');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-bold"><Smartphone size={18} className="text-accent" /> התראות לטלפון</h3>
      {state === 'ios-install' && <p className="mt-2 text-sm text-muted">באייפון צריך קודם להוסיף את האפליקציה למסך הבית: בספארי לחצו על כפתור השיתוף ואז "הוסף למסך הבית". אחר כך פתחו אותה משם והפעילו כאן את ההתראות.</p>}
      {state === 'unsupported' && <p className="mt-2 text-sm text-muted">הדפדפן הזה לא תומך בהתראות. נסו Chrome באנדרואיד או התקינו את האפליקציה במסך הבית.</p>}
      {state === 'denied' && <p className="mt-2 text-sm text-muted">ההתראות חסומות. אפשר לאשר אותן בהגדרות הדפדפן או המכשיר.</p>}
      {(state === 'default' || state === 'granted') && (
        <>
          <p className="mt-2 text-sm text-muted">{subscribed ? 'ההתראות פעילות במכשיר הזה. נעדכן אתכם על אותות קנייה ומכירה, תנועות חדות והתראות המחיר שקבעתם.' : 'קבלו הודעה לטלפון כשיש אות קנייה או מכירה, גם כשהאפליקציה סגורה.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!subscribed && <Button busy={busy} onClick={enable}><BellRing size={16} /> הפעלת התראות</Button>}
            {subscribed && <Button variant="ghost" busy={busy} onClick={test}>שליחת התראת ניסיון</Button>}
          </div>
        </>
      )}
    </Card>
  );
}

export function AlertSettings() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api('/data').then((d) => setS(d.settings)).catch(() => {});
  }, []);
  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    try {
      const r = await api('/settings', patch);
      setS(r.settings);
    } catch (e) {
      toast(e.message);
    }
  };
  if (!s) return null;
  return (
    <Card className="divide-y divide-line py-1">
      <Toggle checked={s.buy} onChange={(v) => save({ buy: v })} label="אותות קנייה" hint="כשמניה שלכם או ברשימת הסריקה מקבלת ציון גבוה" />
      <Toggle checked={s.sell} onChange={(v) => save({ sell: v })} label="אותות מכירה" hint="כשמניה בתיק או במעקב נחלשת" />
      <Toggle checked={s.moves} onChange={(v) => save({ moves: v })} label="תנועות חדות" hint="כשמניה זזה הרבה ביום אחד" />
      <Toggle checked={s.market} onChange={(v) => save({ market: v })} label="מצב השוק" hint="ירידות או עליות חדות בשוק כולו" />
      <div className="py-3">
        <div className="flex items-center justify-between text-sm font-medium"><span>סף לתנועה חדה</span><Num className="font-bold">{s.movePct}%</Num></div>
        <input type="range" min="2" max="20" step="1" value={s.movePct} onChange={(e) => setS({ ...s, movePct: Number(e.target.value) })} onPointerUp={() => save({ movePct: s.movePct })} onKeyUp={() => save({ movePct: s.movePct })} onBlur={() => save({ movePct: s.movePct })} className="mt-2 w-full accent-[var(--color-accent)]" dir="ltr" aria-label="סף לתנועה חדה באחוזים" />
      </div>
    </Card>
  );
}

export default function Alerts({ onRead }) {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api('/alerts');
      setAlerts(r.alerts);
      // פתיחת המסך = קריאה (ההדגשה נשארת עד שיוצאים)
      if (r.alerts.some((a) => !a.read)) {
        api('/alerts/read').then(() => onRead?.()).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    }
  }, [onRead]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">התראות</h1>
        {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
        {!alerts && !error && <Spinner />}
        {alerts && alerts.length === 0 && <Empty>עוד אין התראות. כשיהיה אות קנייה או מכירה, הוא יופיע כאן.</Empty>}
        {alerts && alerts.length > 0 && (
          <Card className="divide-y divide-line p-0">
            {alerts.map((a) => {
              const Wrap = a.symbol ? 'a' : 'div';
              return (
                <Wrap key={a.id} href={a.symbol ? stockLink(a.symbol) : undefined} className={`block px-4 py-3 ${a.symbol ? 'hover:bg-soft' : ''} ${a.read ? '' : 'bg-soft'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium leading-snug">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(a.t)}</span>
                  </div>
                  {a.body && <p className="mt-0.5 text-sm text-muted">{a.body}</p>}
                </Wrap>
              );
            })}
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <PushCard />
        <div>
          <SectionTitle>אילו התראות לקבל</SectionTitle>
          <AlertSettings />
        </div>
      </div>
    </div>
  );
}
