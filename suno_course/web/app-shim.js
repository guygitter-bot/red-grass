// התאמה של הקורס לאפליקציה עצמאית: במקום ה-AI של Claude.ai – פנייה לשרת של הקורס.
// הקורס קורא ל-claude.use('sample'); כאן הוא מקבל פונקציה שעובדת מול השרת (עם סיסמה).
// שאר היכולות (db וכו') לא קיימות כאן, והקורס שומר בדפדפן.
const COURSE_API = 'https://suno-course-api.guygitter.workers.dev';
const KEY_NAME = 'sc_aikey';
const getKey = () => { try { return localStorage.getItem(KEY_NAME) || ''; } catch (e) { return ''; } };
const setKey = v => { try { v ? localStorage.setItem(KEY_NAME, v) : localStorage.removeItem(KEY_NAME); } catch (e) { } };

// חלון קטן להקלדת הסיסמה (פעם אחת; נשמרת בטלפון)
function askKey(msg) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'keydlg';
    wrap.innerHTML = `<form class="keybox" role="dialog" aria-modal="true" aria-labelledby="kt">
      <h3 id="kt">חיבור ה-AI</h3>
      <p>${msg || 'כדי להשתמש במדריך, במעבדת הנישות ובשיפורי ה-AI מקלידים את סיסמת הקורס. הסיסמה נשמרת בטלפון הזה.'}</p>
      <div class="field"><label for="k_in">סיסמה</label><input id="k_in" type="password" autocomplete="current-password" required></div>
      <div class="row"><button class="btn pri" type="submit">שמירה</button><button class="btn" type="button" id="k_no">ביטול</button></div></form>`;
    document.body.appendChild(wrap);
    const close = v => { wrap.remove(); resolve(v); };
    wrap.querySelector('#k_no').onclick = () => close('');
    wrap.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = wrap.querySelector('#k_in').value.trim(); setKey(v); close(v); });
    wrap.querySelector('#k_in').focus();
  });
}

function toTurns(input) {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  return input.map(m => ({ role: m.role, content: String(m.content) }));
}

async function callCourseAI(input, opts) {
  opts = opts || {};
  let key = getKey();
  if (!key) key = await askKey();
  if (!key) throw { code: 'needs_key', he: 'כדי להשתמש ב-AI צריך להקליד את סיסמת הקורס (בתפריט ← "חיבור ה-AI").' };
  let res;
  try {
    res = await fetch(COURSE_API + '/ai', {
      method: 'POST', signal: opts.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ messages: toTurns(input), tier: opts.modelTier || 'default' }),
    });
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw { code: 'cancelled' };
    throw { code: 'upstream_error', he: 'אין חיבור לשרת. בודקים את האינטרנט ומנסים שוב.' };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { setKey(''); throw { code: 'bad_key', he: 'הסיסמה לא נכונה. לוחצים שוב ומקלידים אותה מחדש.' }; }
  if (!res.ok || data.error) throw { code: data.code || 'upstream_error', he: data.error || 'ה-AI לא הצליח לענות. נסו שוב.' };
  if (opts.onText) opts.onText({ text: data.text, delta: data.text });
  return { text: data.text, truncated: !!data.truncated, modelTierApplied: opts.modelTier || 'default' };
}

// קריאת JSON סלחנית: כל התשובה, או מתוך ``` , או מהסוגר הראשון עד האחרון
function parseLoose(t) {
  try { return JSON.parse(t); } catch (e) { }
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) { } }
  const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { } }
  throw { code: 'invalid_json', text: t };
}
const courseSample = (input, opts) => callCourseAI(input, opts);
courseSample.json = async (input, opts) => {
  const turns = toTurns(input);
  turns[turns.length - 1].content += '\n\n(Reply with only the JSON value, no other text.)';
  const { text } = await callCourseAI(turns, opts);
  return parseLoose(text);
};

window.claude = { use: async name => (name === 'sample' ? courseSample : null) };
window.courseAskKey = askKey;
