// מצב של שוט, וההפקה שלו: פריים פתיחה -> סרטון (פעולה ארוכה אצל Google) -> הקובץ נשמר במכשיר.
import { makeStill, startClip, clipStatus, clipFile } from './api';
import { getMedia, putMedia } from './store';

export const POLL_MS = 10_000;
export const MAX_WAIT_MS = 15 * 60 * 1000;

// busy: מה רץ עכשיו במכשיר הזה ('still' / 'clip' / undefined)
export function shotState(shot, busy) {
  if (shot.hasClip) return 'done';
  if (busy === 'still') return 'making-still';
  if (shot.op || busy === 'clip') return 'filming';
  if (shot.still && !shot.hasStill) return 'needs-still';
  return 'ready-to-film';
}

// כמה זמן מחכים, כטקסט: "0:45", "2:05"
export function waitText(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export const readyCount = (project) => project.shots.filter((s) => s.hasClip).length;

// בקשה מיוחדת של המשתמש לשוט – מצורפת להוראה של הבמאי
export function withExtra(text, extra) {
  const e = String(extra || '').trim();
  return e ? `${text}\n\nExtra request from the client (may be in Hebrew): ${e}` : text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// פריים הפתיחה של השוט. patch(שינויים) שומר את השוט
export async function produceStill(project, shot, patch) {
  const source = await getMedia(`${project.id}:${shot.source}`);
  if (!source) throw new Error('התמונה המקורית לא נמצאת במכשיר הזה.');
  const image = await makeStill(source, withExtra(shot.still, shot.extra), project.brief, shot.source);
  await putMedia(`${shot.id}:still`, image);
  await patch({ hasStill: true, error: '', detail: '' });
}

// הסרטון של השוט: מתחיל (אם עוד לא התחיל), מחכה, ומוריד. אפשר לסגור את האפליקציה באמצע – ממשיך מאותה פעולה
export async function produceClip(project, shot, patch, alive = () => true) {
  let { op, opAt } = shot;
  if (!op) {
    const frame = await getMedia(shot.still ? `${shot.id}:still` : `${project.id}:${shot.source}`);
    if (!frame) throw new Error('הפריים לא נמצא במכשיר הזה.');
    const started = await startClip(frame, withExtra(shot.motion, shot.extra), project.brief.aspect, project.quality);
    op = started.op;
    opAt = Date.now();
    await patch({ op, opAt, error: '', detail: '' });
  }
  for (;;) {
    if (!alive()) return;
    let state;
    try {
      state = await clipStatus(op);
    } catch (e) {
      // תקלת רשת רגעית בזמן ההמתנה – ממשיכים לחכות (הסרטון ממשיך להיווצר אצל Google)
      if (e.code || Date.now() - opAt > MAX_WAIT_MS) throw e;
      state = { done: false };
    }
    if (state.done) {
      if (state.error) {
        await patch({ op: '', opAt: 0 });
        const err = new Error(state.error);
        err.detail = state.detail || '';
        throw err;
      }
      await patch({ resolution: state.resolution || '' });
      break;
    }
    if (Date.now() - opAt > MAX_WAIT_MS) {
      await patch({ op: '', opAt: 0 });
      throw new Error('הסרטון לוקח יותר מדי זמן. נסו ליצור אותו שוב.');
    }
    await sleep(POLL_MS);
  }
  const blob = await clipFile(op);
  await putMedia(`${shot.id}:clip`, blob);
  await patch({ hasClip: true, op: '', opAt: 0, error: '', detail: '' });
}
