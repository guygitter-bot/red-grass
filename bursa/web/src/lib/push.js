// התראות לטלפון (Web Push). באייפון עובד רק אחרי הוספת האפליקציה למסך הבית
import { api } from './api';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

// granted | denied | default | unsupported | ios-install (אייפון בלי התקנה)
export function notifyState() {
  if (!pushSupported()) return isIOS() && !standalone() ? 'ios-install' : 'unsupported';
  return Notification.permission;
}

function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

async function registration() {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('ההתראות לא זמינות כרגע. נסו לסגור ולפתוח את האפליקציה')), 8000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

// הפעלת התראות: מבקש אישור, נרשם בדפדפן ושולח את ההרשמה לשרת
export async function enableNotifications() {
  if (!pushSupported()) throw new Error('המכשיר הזה לא תומך בהתראות');
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('ההתראות לא אושרו. אפשר לאשר אותן בהגדרות הדפדפן');
  }
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api('/push/key');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
  }
  await api('/push/subscribe', { sub: sub.toJSON() });
  return true;
}

// האם המכשיר הזה כבר רשום
export async function isSubscribed() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await registration();
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
