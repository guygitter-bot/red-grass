// התראות לטלפון (Web Push): הרשמה / ביטול מול הדפדפן והשרת
import { api } from './api';

// מפתח ציבורי (base64url) -> בתים, כפי שהדפדפן דורש
export function urlBase64ToUint8Array(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('המכשיר הזה לא תומך בהתראות');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('לא אושרו התראות. אפשר לאשר בהגדרות הדפדפן');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/app/push/key', {});
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await api('/app/push/subscribe', { sub: sub.toJSON() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  await api('/app/push/unsubscribe', { endpoint });
}
