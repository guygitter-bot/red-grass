// האפליקציה בחנויות (Capacitor, mat_kon/mobile) מריצה את אותו קוד בתוך WebView.
// שם אין service worker, כפתור Google של הדפדפן לא עובד, וסרטוני ההדרכה לא נארזים באפליקציה (נטענים מהאתר).
export const isNative = () => Boolean(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());

const SITE = 'https://mat-kon.pages.dev/';
export const siteAsset = (path) => (isNative() ? SITE + path : path);

// חלון השיתוף של המערכת. באפליקציה לאנדרואיד דרך התוסף Share (ב-WebView אין navigator.share).
// מחזיר false כשאין שיתוף (ואז מעתיקים); ביטול של המשתמש נזרק כשגיאה
export async function shareText({ title, text }) {
  if (isNative()) {
    const { registerPlugin } = await import('@capacitor/core');
    await registerPlugin('Share').share({ title, text, dialogTitle: title });
    return true;
  }
  if (!navigator.share) return false;
  await navigator.share({ title, text });
  return true;
}
