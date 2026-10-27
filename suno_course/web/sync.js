// סנכרון בין המחשב לטלפון (רק באפליקציה): אותה סיסמה = אותם נתונים.
// כל מפתח נשמר עם זמן העדכון שלו (sc__t_<מפתח>); בשרת – העדכון האחרון לכל מפתח מנצח.
// מסמנים מפתח לשליחה רק כשהערך באמת השתנה, ושולחים רק אחרי שמשכנו מהשרת – כדי שמכשיר עם נתונים ישנים לא ידרוס מכשיר אחר.
const SYNC_KEYS = ['done', 'chk', 'tutor', 'niches', 'track', 'trackmeta', 'calc', 'prompt', 'meta'];
const syncT = {
  get: k => { try { return +localStorage.getItem('sc__t_' + k) || 0; } catch (e) { return 0; } },
  set: (k, t) => { try { localStorage.setItem('sc__t_' + k, String(t)); } catch (e) { } }
};
const rawGet = k => { try { return localStorage.getItem('sc_' + k); } catch (e) { return null; } };
const baseSet = store.set;
const dirty = new Set();
let pulled = false, pushTimer = null, lastPull = 0, syncBusy = false;

store.set = (k, v) => {
  const before = rawGet(k);
  baseSet(k, v);
  if (!SYNC_KEYS.includes(k) || rawGet(k) === before) return;
  syncT.set(k, Date.now()); dirty.add(k);
  clearTimeout(pushTimer); pushTimer = setTimeout(syncPush, 1500);
};

function syncStatus(t, bad) { const el = document.getElementById('syncState'); if (el) { el.textContent = t; el.style.color = bad ? 'var(--bad)' : 'var(--muted)'; } }

async function syncCall(path, body, keepalive) {
  const key = getKey(); if (!key) { syncStatus('☁ לא מסונכרן – להקליד סיסמה', true); return null; }
  const res = await fetch(COURSE_API + path, { method: 'POST', keepalive: !!keepalive, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(body || {}) });
  if (res.status === 401) { syncStatus('☁ הסיסמה לא נכונה', true); return null; }
  if (!res.ok) throw new Error('sync ' + res.status);
  return res.json();
}

// פעם ראשונה במכשיר שכבר יש בו נתונים: פרקים ורשימות מתאחדים, ולא נדרסים
function firstMerge(k, local, server) {
  if (k === 'done') return [...new Set([...(server || []), ...(local || [])])];
  if (k === 'chk') { const out = { ...(server || {}) }; for (const [m, arr] of Object.entries(local || {})) { const s = out[m] || []; out[m] = Array.from({ length: Math.max(s.length, arr.length) }, (_, i) => !!(s[i] || arr[i])); } return out; }
  return server;
}

function syncRefresh() {
  done = new Set(store.get('done', []));
  checks = store.get('chk', {});
  tutorTurns = store.get('tutor', []);
  renderNav(); route();
  if (window.tutorRedraw) window.tutorRedraw();
}

async function syncPull() {
  if (syncBusy) return; syncBusy = true;
  try {
    syncStatus('☁ מסנכרן…');
    const res = await syncCall('/sync/get'); if (!res) return;
    const data = res.data || {}; let changed = false;
    for (const k of SYNC_KEYS) {
      const s = data[k], lt = syncT.get(k), hasLocal = rawGet(k) != null;
      if (s && s.t > lt && !dirty.has(k)) {
        let v = s.v;
        if (lt === 0 && hasLocal) {
          v = firstMerge(k, store.get(k, null), s.v);
          if (JSON.stringify(v) !== JSON.stringify(s.v)) dirty.add(k);
        }
        if (rawGet(k) !== JSON.stringify(v)) changed = true;
        baseSet(k, v); syncT.set(k, dirty.has(k) ? Date.now() : s.t);
      } else if (hasLocal && (!s || lt > s.t)) {
        if (!lt) syncT.set(k, Date.now());
        dirty.add(k);
      }
    }
    pulled = true; lastPull = Date.now();
    if (changed) syncRefresh();
    syncStatus('☁ מסונכרן ✓');
    if (dirty.size) await syncPush();
  } catch (e) { syncStatus('☁ אין חיבור – יסונכרן אחר כך', true); }
  finally { syncBusy = false; }
}

async function syncPush(keepalive) {
  if (!pulled || !dirty.size) return;
  const keys = [...dirty], changes = {};
  for (const k of keys) changes[k] = { v: store.get(k, null), t: syncT.get(k) };
  try {
    const res = await syncCall('/sync/put', { changes }, keepalive);
    if (!res) return;
    // מנקים רק מה שלא השתנה שוב בזמן השליחה
    for (const k of keys) if (syncT.get(k) === changes[k].t) dirty.delete(k);
    syncStatus('☁ מסונכרן ✓');
  } catch (e) { syncStatus('☁ אין חיבור – יסונכרן אחר כך', true); }
}

function courseSyncStart() {
  document.querySelector('.side-tools').insertAdjacentHTML('afterbegin', '<span class="note" id="syncState">☁ מסנכרן…</span>');
  syncPull();
  document.addEventListener('course-key', () => { pulled = false; syncPull(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncPush(true);
    else if (Date.now() - lastPull > 15000) syncPull();
  });
}
