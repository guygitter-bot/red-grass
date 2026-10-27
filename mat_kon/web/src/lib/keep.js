// ייבוא פתקים מ-Google Keep (קובץ Google Takeout): כל פתק הופך ל"הודעה", ומשם אותו מסלול כמו צ'אט מווטסאפ –
// מזהים פתקים שנראים כמו מתכון או שיש בהם קישור למתכון, והמשתמש בוחר מה להכניס לספר.
import { strFromU8, unzipSync } from 'fflate';

const KEEP_NOTE = /(^|\/)Keep\/[^/]+\.json$/i;

export const isKeepTakeout = (bytes) => {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return false;
  try {
    return Object.keys(unzipSync(bytes, { filter: (f) => KEEP_NOTE.test(f.name) })).length > 0;
  } catch {
    return false;
  }
};

// פתק אחד -> הודעה {author, date, text}: כותרת, טקסט, ורשימת תיוג (כמו רשימת מצרכים). פתקים בפח – לא
export function noteToMessage(note) {
  if (!note || note.isTrashed) return null;
  const list = (note.listContent || []).map((i) => String(i?.text || '').trim()).filter(Boolean);
  const labels = (note.labels || []).map((l) => l?.name).filter(Boolean);
  const text = [String(note.title || '').trim(), String(note.textContent || '').trim(), list.join('\n')].filter(Boolean).join('\n');
  if (!text) return null;
  const usec = Number(note.createdTimestampUsec || note.userEditedTimestampUsec) || 0;
  const date = usec ? new Date(usec / 1000).toLocaleDateString('he-IL') : '';
  // תווית "מתכון" / "recipe" – סימן ברור שזה מתכון (גם אם הפתק קצר)
  const tagged = labels.some((l) => /מתכו[ןנ]|recipe|בישול|אוכל/i.test(l));
  return { author: 'Google Keep', date, text, tagged };
}

export function readKeepTakeout(bytes) {
  const files = unzipSync(bytes, { filter: (f) => KEEP_NOTE.test(f.name) });
  const notes = [];
  for (const data of Object.values(files)) {
    try {
      const m = noteToMessage(JSON.parse(strFromU8(data)));
      if (m) notes.push(m);
    } catch {
      // פתק פגום – מדלגים
    }
  }
  if (!notes.length) throw new Error('לא נמצאו פתקים בקובץ. ייצאו מ-Google Takeout רק את Keep ונסו שוב.');
  return notes;
}
