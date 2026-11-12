// השמירה במכשיר (IndexedDB): הכול נשאר בטלפון / במחשב, שום דבר לא נשמר בשרת.
//   projects: { id, name, createdAt, thumb, room?, ideas?, versions: [{ id, request, title?, thumb, createdAt }] }
//   images:   מפתח = מזהה הפרויקט (הצילום המקורי) או מזהה הגרסה -> { media_type, data }
const DB = 'meatzev-habayit';
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('projects', { keyPath: 'id' });
        req.result.createObjectStore('images');
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
    const t = db.transaction(['projects', 'images'], mode);
    const req = fn(t.objectStore('projects'), t.objectStore('images'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// פרויקט ישן שחסר בו שדה ממשיך לעבוד
export const safeProject = (p) => ({ name: '', createdAt: 0, thumb: '', room: '', ideas: [], ...p, versions: Array.isArray(p?.versions) ? p.versions : [] });

export async function listProjects() {
  const all = (await tx('readonly', (projects) => projects.getAll())) || [];
  return all.map(safeProject).sort((a, b) => b.createdAt - a.createdAt);
}

export const getImage = (key) => tx('readonly', (_, images) => images.get(key));

export const saveProject = (project) => tx('readwrite', (projects) => { projects.put(project); });

export function createProject(project, original) {
  return tx('readwrite', (projects, images) => {
    projects.put(project);
    images.put(original, project.id);
  });
}

export function addVersion(project, version, image) {
  return tx('readwrite', (projects, images) => {
    projects.put(project);
    images.put(image, version.id);
  });
}

export function removeVersion(project, versionId) {
  return tx('readwrite', (projects, images) => {
    projects.put(project);
    images.delete(versionId);
  });
}

export function removeProject(project) {
  return tx('readwrite', (projects, images) => {
    projects.delete(project.id);
    images.delete(project.id);
    for (const v of project.versions) images.delete(v.id);
  });
}
