import { useEffect, useState } from 'react';
import { Link2, Smartphone, Trash2 } from 'lucide-react';
import { Button, ErrorBox, Input } from './ui';
import { createInvite, inviteLink, listDevices, removeDevice } from '../lib/proxy';

const dateText = (ms) => (ms ? new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '');

// רק לבעל האפליקציה: יצירת קישורי הזמנה חד-פעמיים וניהול המכשירים המחוברים.
export default function InviteManager({ settings }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState(null);

  const loadDevices = () =>
    listDevices(settings)
      .then((list) => {
        setDevices(list);
        setError('');
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    loadDevices();
  }, [settings.accessCode, settings.proxyUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    setError('');
    setStatus('יוצר קישור...');
    try {
      const { token } = await createInvite(settings, name.trim());
      const link = inviteLink(token);
      const text = `הזמנה לאפליקציית ביס${name.trim() ? ` עבור ${name.trim()}` : ''}. הקישור עובד פעם אחת בלבד:`;
      try {
        if (navigator.share) await navigator.share({ title: 'ביס', text, url: link });
        else await navigator.clipboard.writeText(`${text}\n${link}`);
        setStatus('הקישור נשלח / הועתק. הוא עובד פעם אחת, במשך 7 ימים.');
      } catch {
        // אם השיתוף בוטל, מציגים את הקישור כדי שאפשר יהיה להעתיק ידנית
        setStatus(link);
      }
      setName('');
    } catch (e) {
      setStatus('');
      setError(e.message);
    }
  };

  const disconnect = async (d) => {
    if (!confirm(`לנתק את "${d.name}"? הסוכן והמאגר המשותף יפסיקו לעבוד במכשיר הזה.`)) return;
    try {
      await removeDevice(settings, d.id);
      loadDevices();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <p className="text-sm font-bold text-slate-700 flex items-center gap-1">
        <Link2 size={16} /> הזמנת משתמש
      </p>
      <p className="text-xs text-slate-500">
        כל קישור עובד פעם אחת בלבד: מי שפותח אותו ראשון מקבל גישה קבועה במכשיר שלו, והקישור מת. קוד הגישה שלך לא נשלח.
      </p>
      <div className="flex gap-2">
        <Input placeholder="למי? (למשל: מירב)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button className="px-4 py-2 whitespace-nowrap" onClick={invite}>
          צור ושלח
        </Button>
      </div>
      {status && <p className="text-xs text-emerald-700 break-all">{status}</p>}
      <ErrorBox>{error}</ErrorBox>

      <p className="text-sm font-bold text-slate-700 flex items-center gap-1 pt-2">
        <Smartphone size={16} /> מכשירים מחוברים
      </p>
      {devices === null ? (
        <p className="text-xs text-slate-400">טוען...</p>
      ) : devices.length === 0 ? (
        <p className="text-xs text-slate-400">אין עדיין מכשירים שהוזמנו.</p>
      ) : (
        devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between text-sm py-1">
            <span>
              {d.name}
              <span className="text-xs text-slate-400"> · התחבר {dateText(d.created)} · פעיל {dateText(d.lastSeen)}</span>
            </span>
            <button onClick={() => disconnect(d)} className="text-red-300 hover:text-red-500 p-1 flex items-center gap-1 text-xs">
              <Trash2 size={14} /> נתק
            </button>
          </div>
        ))
      )}
    </div>
  );
}
