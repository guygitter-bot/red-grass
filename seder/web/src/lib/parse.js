// הבנת טקסט חופשי בעברית: הודעת ווטסאפ מודבקת, או שורה בהוספה מהירה.
// מוציאים מהטקסט כותרת, תאריך ("מחר", "ביום שלישי", "12/10"), שעה ("ב20:00"), קישורים ורמת חשיבות ("!").
import { addDays, toKey, todayKey } from './dates';

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
// אימוג'ים וסימני עיצוב של ווטסאפ (*מודגש*, _נטוי_, ~מחוק~)
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍️]/gu;

export function extractLinks(text) {
  return [...new Set((text.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, '')))];
}

export function linkKind(url) {
  if (/youtu\.?be|vimeo|tiktok|instagram\.com\/(reel|p)\//i.test(url)) return 'video';
  return 'link';
}

function cleanLine(line) {
  return line
    .replace(URL_RE, '')
    .replace(EMOJI_RE, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–•:!.]+|[\s\-–•:]+$/g, '')
    .trim();
}

// תאריך מתוך הטקסט, יחסית ל-now. מחזיר { due, match } או null
export function findDate(text, now = new Date()) {
  const today = todayKey(now);
  let m;
  if ((m = text.match(/(^|[\s,(])(ב?מחרתיים)(?=$|[\s,.!)])/))) return { due: addDays(today, 2), match: m[2] };
  if ((m = text.match(/(^|[\s,(])(ב?מחר|למחר)(?=$|[\s,.!)])/))) return { due: addDays(today, 1), match: m[2] };
  if ((m = text.match(/(^|[\s,(])(היום|הערב|להיום)(?=$|[\s,.!)])/))) return { due: today, match: m[2] };
  if ((m = text.match(/(^|[\s,(])(בשבוע הבא|שבוע הבא)(?=$|[\s,.!)])/))) return { due: addDays(today, 7), match: m[2] };
  // "ביום שלישי", "יום ה'", "בשבת"
  const dayRe = new RegExp(`(^|[\\s,(])((?:ב?יום )(${WEEKDAYS.join('|')})|בשבת|(?:ב?יום )([א-ו])['׳])(?=$|[\\s,.!)])`);
  if ((m = text.match(dayRe))) {
    let idx;
    if (m[3]) idx = WEEKDAYS.indexOf(m[3]);
    else if (m[4]) idx = 'אבגדהו'.indexOf(m[4]);
    else idx = 6;
    let diff = (idx - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return { due: addDays(today, diff), match: m[2] };
  }
  // 12/10, 12.10.26, 12/10/2026 (יום לפני חודש, כמו בישראל)
  if ((m = text.match(/(^|[^\d:])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=$|[^\d:])/))) {
    const day = Number(m[2]);
    const month = Number(m[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let year = m[4] ? Number(m[4]) : now.getFullYear();
      if (year < 100) year += 2000;
      const date = new Date(year, month - 1, day);
      // בלי שנה ותאריך שעבר מזמן – כנראה השנה הבאה
      if (!m[4] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) date.setFullYear(year + 1);
      return { due: toKey(date), match: m[0].slice(m[1].length) };
    }
  }
  return null;
}

// "ב20:00", "בשעה 8:30", "20.00" (רק עם "ב"/"בשעה"), "ב-8 בערב"
export function findTime(text) {
  let m;
  if ((m = text.match(/(?:בשעה|ב-?|ב־|at)?\s?([01]?\d|2[0-3]):([0-5]\d)(?!\d)/))) {
    return { time: `${m[1].padStart(2, '0')}:${m[2]}`, match: m[0] };
  }
  if ((m = text.match(/(?:בשעה|ב-?)\s?([01]?\d|2[0-3])\.([0-5]\d)(?!\d)/))) {
    return { time: `${m[1].padStart(2, '0')}:${m[2]}`, match: m[0] };
  }
  if ((m = text.match(/(?:בשעה|ב-?)\s?(\d{1,2})\s?(בערב|בלילה|אחה"צ|אחר הצהריים|בבוקר|בצהריים)/))) {
    let h = Number(m[1]);
    if (/ערב|לילה|אחה|אחר|צהריים/.test(m[2]) && h < 12) h += 12;
    if (h <= 23) return { time: `${String(h).padStart(2, '0')}:00`, match: m[0] };
  }
  return null;
}

// הוספה מהירה: "להתקשר לרופא מחר ב10:00 !" -> משימה עם תאריך, שעה וחשיבות
export function parseQuick(text, now = new Date()) {
  let rest = text;
  const out = {};
  const date = findDate(rest, now);
  if (date) {
    out.due = date.due;
    rest = rest.replace(date.match, ' ');
  }
  const time = findTime(rest);
  if (time) {
    out.time = time.time;
    rest = rest.replace(time.match, ' ');
  }
  const bang = rest.match(/(^|\s)!{1,3}(?=\s|$)/);
  if (bang) {
    out.priority = 3;
    rest = rest.replace(bang[0], ' ');
  }
  if (/(^|\s)(דחוף|חשוב)(?=\s|$)/.test(rest)) out.priority = 3;
  const links = extractLinks(rest);
  if (links.length) {
    out.links = links.map((url) => ({ url, kind: linkKind(url) }));
    rest = rest.replace(URL_RE, ' ');
  }
  out.title = rest.replace(/\s+/g, ' ').trim() || text.trim();
  return out;
}

// הודעה מווטסאפ (הזמנה, אירוע, המלצה) -> טיוטת משימה
export function parseMessage(text, now = new Date()) {
  const lines = text.split(/\r?\n/).map(cleanLine);
  const links = extractLinks(text).map((url) => ({ url, kind: linkKind(url) }));
  const date = findDate(text, now);
  const time = findTime(text);

  // כותרת: שורה מודגשת (*...*) אם יש, אחרת השורה המשמעותית הראשונה שאינה רק תאריך/שעה
  const bold = text.match(/\*([^*\n]{4,})\*/);
  let title = bold ? cleanLine(bold[1]) : '';
  if (!title) {
    title = lines.find((l) => {
      if (l.length < 4) return false;
      let stripped = l;
      if (date) stripped = stripped.replace(date.match, '');
      if (time) stripped = stripped.replace(time.match, '');
      return stripped.replace(/[^\p{L}]/gu, '').length >= 4 && !/^(זה קורה|תזכורת)$/.test(stripped.trim());
    }) || '';
  }
  if (!title && links.length) title = links[0].url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  if (title.length > 90) title = `${title.slice(0, 87)}...`;

  const draft = {
    title: title || 'הודעה מווטסאפ',
    notes: text.trim(),
    links,
    source: 'whatsapp',
  };
  if (date) draft.due = date.due;
  if (time) {
    draft.time = time.time;
    if (!draft.due) draft.due = todayKey(now);
  }
  // יש מועד -> אירוע עם תזכורת; רק קישורים -> לבדוק בהמשך
  if (draft.due && draft.time) {
    draft.type = 'event';
    draft.remind = 30;
  } else if (draft.due) {
    draft.type = 'task';
  } else if (links.length) {
    draft.type = 'later';
  } else {
    draft.type = 'task';
  }
  return draft;
}
