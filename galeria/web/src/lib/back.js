// כפתור "אחורה" של אנדרואיד: קודם סוגר חלון פתוח (תמונה בגדול), אחר כך חוזר למסך הבית, ורק במסך הבית יוצא מהאפליקציה
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const handlers = [];

// רכיב שפתוח מעל המסך (למשל תמונה בגדול) נרשם כאן; מחזיר פונקציה לביטול הרישום
export function onBack(fn) {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function goBack() {
  if (handlers.length) {
    handlers[handlers.length - 1]();
    return true;
  }
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h) {
    window.location.hash = '#/';
    return true;
  }
  return false;
}

export function initBackButton() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener('backButton', () => {
    if (!goBack()) App.minimizeApp();
  });
}
