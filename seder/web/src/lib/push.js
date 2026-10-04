// התראות דחיפה: המכשיר נרשם אצל השרת, והשרת שולח את התזכורות בזמן – גם כשהאפליקציה סגורה.
// (בטלפון אנדרואיד – בכל דפדפן מודרני; באייפון – רק כשהאפליקציה הותקנה ב"הוספה למסך הבית")
import { apiPost, getToken } from './sync';
import { fromB64url } from './b64';

const FLAG = 'seder_push';

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

// האם המכשיר הזה כבר מקבל תזכורות מהשרת (ואז לא צריך להציג אותן שוב מתוך האפליקציה)
export function pushActive() {
  try {
    return localStorage.getItem(FLAG) === '1' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

function setFlag(on) {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    // אחסון חסום
  }
}

// רישום (או רענון) המכשיר אצל השרת. מחזיר true כשהצליח
export async function enablePush() {
  if (!pushSupported() || Notification.permission !== 'granted' || !getToken()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await apiPost('/push/key');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
    }
    await apiPost('/push/subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setFlag(true);
    return true;
  } catch {
    setFlag(false);
    return false;
  }
}

export async function sendTestPush() {
  return apiPost('/push/test');
}
