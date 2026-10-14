// קהילות חברים: הרשימה של הקהילות שלי נשמרת במכשיר, והקהילה עצמה בשרת (api/club.js).
// התראות "בואו לשחק" – Web Push (באייפון רק כשהאפליקציה מותקנת במסך הבית).
import { api } from './api';

const KEY = 'eir_clubs';

export function myClubs() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((c) => c && c.code) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // מצב פרטי
  }
}

export function rememberClub({ code, name }) {
  save([{ code, name }, ...myClubs().filter((c) => c.code !== code)]);
}

export function forgetClub(code) {
  save(myClubs().filter((c) => c.code !== code));
}

// הקוד מתוך קישור הזמנה לקהילה (?c=ABCDEF) או כפי שהוקלד
export function clubFrom(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&]c=([A-Za-z0-9]{6})/) || s.match(/^([A-Za-z0-9]{6})$/);
  return m ? m[1].toUpperCase() : '';
}

export function clubLink(code) {
  return `${location.origin}${location.pathname}?c=${code}`;
}

export const clubAuth = (code, profile) => ({ club: code, playerId: profile.id, token: profile.token });

// ---------- התראות ----------
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

// המנוי של המכשיר (נוצר פעם אחת, ונשלח לכל הקהילות שלי)
async function deviceSubscription() {
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api('/push/key');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
  }
  return sub.toJSON();
}

// הפעלת התראות (מבקש אישור מהמשתמש) ורישום בקהילות. ask=false – רק אם כבר אישרו בעבר
export async function enableNotifications(profile, codes, ask = true) {
  if (!pushSupported()) throw new Error('המכשיר הזה לא תומך בהתראות');
  if (Notification.permission !== 'granted') {
    if (!ask) return false;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('ההתראות לא אושרו. אפשר לאשר אותן בהגדרות הדפדפן');
  }
  const subscription = await deviceSubscription();
  await Promise.all(codes.map((code) => api('/club/subscribe', { ...clubAuth(code, profile), subscription })));
  return true;
}
