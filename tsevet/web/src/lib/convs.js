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
