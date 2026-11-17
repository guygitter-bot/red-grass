// העתקת תשובה של בוט: טקסט נקי (בלי סימני Markdown), כדי שיודבק יפה בוואטסאפ, במייל או במסמך
export function plainText(md) {
  return String(md || '')
    .replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^(\s*)[-*]\s+/gm, '$1• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// מחזיר true אם הועתק. בדפדפנים ישנים / בלי הרשאה – נפילה לבחירת טקסט והעתקה
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
