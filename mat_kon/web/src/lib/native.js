// האפליקציה בחנויות (Capacitor, mat_kon/mobile) מריצה את אותו קוד בתוך WebView.
// שם אין service worker, כפתור Google של הדפדפן לא עובד, וסרטוני ההדרכה לא נארזים באפליקציה (נטענים מהאתר).
export const isNative = () => Boolean(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());

const SITE = 'https://mat-kon.pages.dev/';
export const siteAsset = (path) => (isNative() ? SITE + path : path);
