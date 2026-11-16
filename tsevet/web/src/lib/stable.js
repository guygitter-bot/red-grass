// בין רענון לרענון הכתובות החתומות של הקבצים יכולות להשתנות, וההודעות מגיעות כאובייקטים חדשים.
// כדי שסרטון שמתנגן לא יופסק – שומרים את הכתובת הראשונה של כל קובץ, ומחזירים את אותו אובייקט הודעה אם לא השתנה בה דבר.
function collectUrls(messages) {
  const urls = new Map();
  const add = (f) => {
    if (f && !urls.has(f.id)) urls.set(f.id, { url: f.url, poster: f.poster });
  };
  for (const m of messages) {
    m.files?.forEach(add);
    m.renders?.forEach((r) => add(r.file));
  }
  return urls;
}

export function mergeConv(prev, next) {
  if (!prev || prev.id !== next.id) return next;
  const urls = collectUrls(prev.messages || []);
  const fix = (f) => {
    const u = f && urls.get(f.id);
    if (!u) return f;
    const out = { ...f, url: u.url };
    if (u.poster) out.poster = u.poster;
    return out;
  };
  const before = new Map((prev.messages || []).map((m) => [m.i, m]));
  const messages = (next.messages || []).map((m) => {
    const fixed = { ...m };
    if (m.files) fixed.files = m.files.map(fix);
    if (m.renders) fixed.renders = m.renders.map((r) => (r.file ? { ...r, file: fix(r.file) } : r));
    const old = before.get(m.i);
    return old && JSON.stringify(old) === JSON.stringify(fixed) ? old : fixed;
  });
  return { ...next, messages };
}
