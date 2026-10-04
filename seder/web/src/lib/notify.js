// התראות מערכת (כשיש הרשאה). בטלפון הן עוברות דרך ה-service worker
export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export async function askPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function notify(task) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const body = [task.time, task.links?.[0]?.url].filter(Boolean).join(' · ');
  const options = { body, tag: task.id, data: { id: task.id }, icon: 'icon.svg', dir: 'rtl', lang: 'he' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(`🔔 ${task.title}`, options);
    else new Notification(`🔔 ${task.title}`, options);
  } catch {
    // דפדפן שלא מאפשר התראות מהדף – נשארת ההודעה בתוך האפליקציה
  }
}
