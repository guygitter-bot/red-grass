// השמירה במכשיר (IndexedDB): הכול נשאר בטלפון / במחשב, שום דבר לא נשמר בשרת.
//   projects: { id, name, tagline, contact, createdAt, thumb, brief, has: {photo, plan}, quality, summary, shots: [...] }
//   שוט:      { id, title, why, source, still, motion, extra, hasStill, op, opAt, hasClip, resolution, error, detail }
//   media:    "<פרויקט>:photo" / "<פרויקט>:plan" / "<שוט>:still" -> { media_type, data } ; "<שוט>:clip" -> Blob (הסרטון)
const DB = 'nadlan-video';
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('projects', { keyPath: 'id' });
        req.result.createObjectStore('media');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return opening;
}

// פעולה אחת או כמה בעסקה אחת; fn מקבל את המחסנים ומחזיר בקשה (או כלום)
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['projects', 'media'], mode);
    const req = fn(t.objectStore('projects'), t.objectStore('media'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// שוט / פרויקט ישן שחסר בו שדה ממשיך לעבוד
export const safeShot = (s) => ({ title: '', why: '', source: 'photo', still: '', motion: '', extra: '', hasStill: false, op: '', opAt: 0, hasClip: false, resolution: '', error: '', detail: '', ...s });
export const safeProject = (p) => ({
  name: '', tagline: '', contact: '', createdAt: 0, thumb: '', quality: 'max', summary: '',
  ...p,
  brief: { kind: 'building', look: 'golden', aspect: '16:9', note: '', ...(p?.brief || {}) },
  has: { photo: false, plan: false, ...(p?.has || {}) },
  shots: (Array.isArray(p?.shots) ? p.shots : []).map(safeShot),
});

export async function listProjects() {
  const all = (await tx('readonly', (projects) => projects.getAll())) || [];
  return all.map(safeProject).sort((a, b) => b.createdAt - a.createdAt);
}

export const getMedia = (key) => tx('readonly', (_, media) => media.get(key));
export const putMedia = (key, value) => tx('readwrite', (_, media) => { media.put(value, key); });
export const saveProject = (project) => tx('readwrite', (projects) => { projects.put(project); });

// פרויקט חדש עם התמונות שהועלו: images = { photo?, plan? }
export function createProject(project, images) {
  return tx('readwrite', (projects, media) => {
    projects.put(project);
    for (const [k, im] of Object.entries(images)) if (im) media.put(im, `${project.id}:${k}`);
  });
}

export function removeProject(project) {
  return tx('readwrite', (projects, media) => {
    projects.delete(project.id);
    media.delete(`${project.id}:photo`);
    media.delete(`${project.id}:plan`);
    for (const s of project.shots) {
      media.delete(`${s.id}:still`);
      media.delete(`${s.id}:clip`);
    }
  });
}
