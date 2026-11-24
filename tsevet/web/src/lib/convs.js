// פעולות על שיחות: פתיחת שיחה חדשה (אפשר עם בוט מסוים כיעד)
import { api } from './api';
import { go, setPreset } from './route';

export async function newConversation(to) {
  try {
    const { id } = await api('/app/conv/new', {});
    if (to) setPreset(id, to);
    go(`/c/${encodeURIComponent(id)}`);
  } catch (e) {
    alert(e.message);
  }
}

// חדר חדש: שיחה עם בוטים נבחרים בלבד (2-6, אפשר עם המנהל)
export async function newRoom(members, title) {
  const { id } = await api('/app/conv/new', { members, title });
  go(`/c/${encodeURIComponent(id)}`);
  return id;
}

export const ROOM_MIN = 2;
export const ROOM_MAX = 6;
export const roomReady = (members) => members.length >= ROOM_MIN && members.length <= ROOM_MAX;

// למי הבעלים פנה לאחרונה בשיחה. בשיחות ישנות (בלי to) – הבוט היחיד שענה, אם היה רק אחד
export function lastTarget(messages = []) {
  const mine = [...messages].reverse().find((m) => m.who === 'owner' && m.to);
  if (mine) return mine.to;
  const bots = new Set(messages.filter((m) => m.who !== 'owner' && m.who !== 'system').map((m) => m.who));
  return bots.size === 1 ? [...bots][0] : null;
}
