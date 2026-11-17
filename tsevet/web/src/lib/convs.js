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
