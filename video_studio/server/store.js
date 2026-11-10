// מצב הפרויקט: שמירה לדיסק, ביטול/חזרה, ושידור שינויים לכל הדפדפנים הפתוחים (SSE).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyProject, DEFAULT_CAPTION_STYLE } from './edit.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.resolve(process.env.STUDIO_DATA || path.join(ROOT, 'data'));
export const DIRS = {
  media: path.join(DATA, 'media'),
  exports: path.join(DATA, 'exports'),
  sfx: path.join(DATA, 'sfx'),
  cache: path.join(DATA, 'cache'),
  models: path.join(DATA, 'models'),
  fonts: path.join(ROOT, 'fonts'),
  web: path.join(ROOT, 'web'),
};
for (const d of [DIRS.media, DIRS.exports, DIRS.sfx, DIRS.cache]) fs.mkdirSync(d, { recursive: true });

const FILE = path.join(DATA, 'project.json');
const HISTORY_MAX = 200;

export let project = emptyProject();
export let rev = 0;
const undoStack = [];
const redoStack = [];
const listeners = new Set();
export const jobs = new Map();

try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  project = { ...emptyProject(), ...saved.project };
  project.settings = { ...emptyProject().settings, ...project.settings };
  project.captionStyle = { ...DEFAULT_CAPTION_STYLE, ...project.captionStyle };
  // מדיה שהעיבוד שלה נקטע כשהשרת נסגר
  project.media = project.media.filter((m) => m.status === 'ready');
  rev = saved.rev || 0;
} catch { /* פרויקט חדש */ }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE + '.tmp', JSON.stringify({ rev, project }), (err) => {
      if (!err) fs.rename(FILE + '.tmp', FILE, () => {});
    });
  }, 200);
}

// המדיה לא חלק מהביטול: ביטול לא מוחק קובץ שהועלה.
const snapshot = () => JSON.stringify({ settings: project.settings, tracks: project.tracks, clips: project.clips, captionStyle: project.captionStyle });
const restore = (s) => Object.assign(project, JSON.parse(s));

export function publicState() {
  return { rev, project, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}

export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of listeners) res.write(msg);
}

export function subscribe(res) {
  listeners.add(res);
  res.on('close', () => listeners.delete(res));
}

function changed() {
  rev++;
  save();
  broadcast('project', publicState());
}

// שינוי שאפשר לבטל. אם הפעולה נכשלת – המצב חוזר לקדמותו.
export function commit(fn) {
  const before = snapshot();
  let result;
  try {
    result = fn(project);
  } catch (e) {
    restore(before);
    throw e;
  }
  if (snapshot() !== before) {
    undoStack.push(before);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack.length = 0;
    changed();
  }
  return result;
}

// שינוי במדיה (לא נכנס להיסטוריה)
export function touchMedia(fn) {
  const result = fn(project);
  changed();
  return result;
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  changed();
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  changed();
  return true;
}

export function resetProject() {
  const media = project.media;
  commit((p) => Object.assign(p, emptyProject(), { media }));
}

// משימות ארוכות (ייצוא, תמלול): מצב + התקדמות
export function createJob(type, extra = {}) {
  const job = { id: `${type}_${Date.now().toString(36)}`, type, status: 'running', progress: 0, message: '', ...extra };
  jobs.set(job.id, job);
  broadcast('job', job);
  return job;
}

export function updateJob(job, patch) {
  Object.assign(job, patch);
  const { proc, promise, ...pub } = job;
  broadcast('job', pub);
}

export const publicJob = ({ proc, promise, ...pub }) => pub;
