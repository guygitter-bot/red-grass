// ===== מנוע הקורס: ניווט, התקדמות, ערכה =====
const store = {
  get(k, d) { try { const v = localStorage.getItem('sc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sc_' + k, JSON.stringify(v)); } catch (e) { } }
};
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const fmt = (n, d) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 });
let done = new Set(store.get('done', []));
let checks = store.get('chk', {});
let SAMPLE = null; // יכולת ה-AI, אם קיימת

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const o = btn.textContent; btn.textContent = 'הועתק ✓'; setTimeout(() => btn.textContent = o, 1400); } }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); if (btn) btn.textContent = 'הועתק ✓'; } catch (x) { if (btn) btn.textContent = 'סמנו והעתיקו ידנית'; }
    ta.remove();
  }
}
function outBlock(label, text, he) {
  const id = 'o' + Math.random().toString(36).slice(2, 8);
  return `<div><div class="copyrow"><span>${label}</span><button class="btn sm" type="button" data-copy="${id}">העתקה</button></div><div class="out${he ? ' he' : ''}" id="${id}">${esc(text)}</div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const el = document.getElementById(b.dataset.copy); if (el) copyText(el.textContent, b);
});

function renderNav() {
  // קבוצות לפי הסדר: כותרת חדשה בכל פעם שהקבוצה מתחלפת
  let html = '', curG = null;
  MODULES.forEach((m, i) => {
    if (m.group !== curG) { html += (curG ? '</div>' : '') + `<div class="navgroup"><h4>${m.group}</h4>`; curG = m.group; }
    html += `<a href="#${m.id}" data-id="${m.id}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${m.title}</span><span class="done">${done.has(m.id) ? '✓' : ''}</span></a>`;
  });
  $('#nav').innerHTML = html + '</div>';
  const pct = Math.round(done.size / MODULES.length * 100);
  $('#pct').textContent = pct + '%'; $('#topPct').textContent = pct + '%'; $('#pbar').style.width = pct + '%';
  const lit = Math.round(pct / 100 * 12);
  $('#vu').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < lit ? (i >= 9 ? 'hot' : 'on') : ''}" style="height:${8 + i * 1.5}px"></i>`).join('');
}

function show(id) {
  const idx = Math.max(0, MODULES.findIndex(m => m.id === id));
  const m = MODULES[idx];
  const prev = MODULES[idx - 1], next = MODULES[idx + 1];
  const ck = checks[m.id] || [];
  $('#view').innerHTML = `
    <header class="mhead">
      <span class="eyebrow">פרק ${idx + 1} מתוך ${MODULES.length} · ${m.group}</span>
      <h2>${m.title}</h2>
      <div class="mmeta"><span class="chip">⏱ כ-${m.min} דקות</span>${done.has(m.id) ? '<span class="chip">✓ הושלם</span>' : ''}</div>
      <p class="lead">${m.lead}</p>
    </header>
    <div class="content">${m.body()}
      <h3>לפני שממשיכים</h3>
      <ul class="checklist">${m.check.map((c, i) => `<li><label><input type="checkbox" id="ck-${m.id}-${i}" data-ck="${i}" ${ck[i] ? 'checked' : ''}> ${c}</label></li>`).join('')}</ul>
    </div>
    <div class="done-row">
      ${prev ? `<a class="btn" href="#${prev.id}">→ ${prev.title}</a>` : '<span></span>'}
      <button class="btn ${done.has(m.id) ? '' : 'pri'}" type="button" id="doneBtn">${done.has(m.id) ? 'סימון כלא הושלם' : 'סיימתי את הפרק ✓'}</button>
      ${next ? `<a class="btn" href="#${next.id}">${next.title} ←</a>` : '<span></span>'}
    </div>`;
  $$('#nav a').forEach(a => a.classList.toggle('cur', a.dataset.id === m.id));
  $('#topTitle').textContent = m.title;
  $$('[data-ck]').forEach(cb => cb.addEventListener('change', () => {
    const arr = checks[m.id] || []; arr[+cb.dataset.ck] = cb.checked; checks[m.id] = arr; store.set('chk', checks);
  }));
  $('#doneBtn').onclick = () => {
    done.has(m.id) ? done.delete(m.id) : done.add(m.id);
    store.set('done', [...done]); renderNav();
    if (done.has(m.id) && next) location.hash = next.id; else show(m.id);
  };
  $$('[data-tool]').forEach(el => { const f = TOOLS[el.dataset.tool]; if (f) f(el); });
  $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
  store.set('last', m.id);
}

function route() {
  const h = (location.hash || '').slice(1);
  show(MODULES.some(m => m.id === h) ? h : store.get('last', 'start'));
}

function initTheme() {
  const t = store.get('theme', null);
  if (t) document.documentElement.setAttribute('data-theme', t);
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nt); store.set('theme', nt);
  };
}

// הודעת שגיאה של ה-AI בעברית
function aiErr(e) {
  if (e && e.he) return e.he; // הודעה מוכנה מהאפליקציה העצמאית
  const c = e && e.code;
  if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled') return 'ה-AI לא זמין כאן. צריך לאשר לעמוד להשתמש ב-Claude (בחלון שנפתח), או לפתוח את הקורס מתוך Claude.';
  if (c === 'rate_limited') return 'יותר מדי בקשות כרגע. מחכים דקה ומנסים שוב.';
  if (c === 'session_expired') return 'צריך להתחבר מחדש ל-Claude.';
  if (c === 'refused') return 'ה-AI לא ענה על השאלה הזאת. נסו לנסח אחרת.';
  if (c === 'invalid_json') return 'התשובה הגיעה בפורמט לא תקין. לחצו שוב.';
  if (c === 'cancelled') return '';
  return 'משהו השתבש בחיבור ל-AI. נסו שוב.';
}

function initMenu() {
  $('#menuBtn').onclick = () => { const o = $('#side').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o ? 'true' : 'false'); };
  document.addEventListener('click', e => {
    if (innerWidth > 960) return;
    if ($('#side').classList.contains('open') && !e.target.closest('#side') && !e.target.closest('#menuBtn')) $('#side').classList.remove('open');
  });
}

// ===== המדריך האישי =====
const COURSE_FACTS = `עובדות מפתח מהקורס (נכון לאוקטובר 2026, חלק מהנתונים ממקורות משניים):
- YPP מלא: 1,000 מנויים + 4,000 שעות צפייה ציבוריות ב-365 יום, או 10M צפיות Shorts ב-90 יום. דווח שמ-1.2.2027 מצטרפים חדשים יצטרכו 8,000 שעות או 20M צפיות Shorts. שלב מוקדם: 500 מנויים, 3 העלאות ב-90 יום, 3,000 שעות (בלי פרסומות).
- RPM חציוני בנישת מוזיקה כ-2.28$ (רוב הערוצים 1.35-4.16$). Shorts משלמים 3-14% מסרטון ארוך. היוצר מקבל 55% בסרטונים ארוכים. פרסומות באמצע מ-8 דקות.
- סונו: Free (לא מסחרי, לתמיד, גם אחרי שדרוג), Pro 10$ (2,500 קרדיטים, 20 הורדות בחודש), Premier 30$ (10,000 קרדיטים, 60 הורדות בחודש, Studio). מגבלות ההורדה מ-3.9.2026. Create = כ-10 קרדיטים ו-2 גרסאות. v6 מ-9.9.2026, v6-mini חינמי. שימוש מסחרי קשור להורדה מורשית.
- AI טהור לא מוגן בזכויות יוצרים בארה"ב; הרישיון מסונו מתיר שימוש מסחרי.
- לא לרשום שירים ב-Content ID; לבטל Content ID אצל מפיץ (DistroKid) או לשים את הערוץ ב-whitelist.
- גילוי AI: לפי דף העזרה הרשמי, חובה לגלות תוכן AI ש"יוצר מוזיקה שהיא העיקר בסרטון" – כלומר בכל סרטון בערוץ כזה מסמנים Yes. יוטיוב מוסיף תווית.
- בדיקת YPP: לפי יוטיוב בדרך כלל כחודש; ערעור תוך 21 יום; הגשה מחדש אחרי 30 יום (אחרי דחייה נוספת 90 יום). מחירי סונו נבדקו ב-20.10.2026: Pro 10$ (8$ שנתי), Premier 30$ (24$ שנתי); Free – 50 קרדיטים ביום, אין הורדות.
- מדיניות "תוכן לא אותנטי" מיולי 2025: תוכן המוני וחוזרני. 2026: מחיקת ערוצי AI slop. בדיקה ברמת הערוץ. להמליץ: מותג, סצנה חדשה לכל סרטון, אוצרות, קצב קבוע, כותרות כנות, סימון AI (חובה).
- מס: W-8BEN ב-AdSense, תושבות ישראל; רואה חשבון בישראל, עוסק פטור/מורשה.
- עריכה: CapCut למחשב, 1080p H.264, לולאה מונפשת, fade בין שירים; לא להשתמש במוזיקה של CapCut. חלופות: DaVinci Resolve, FFmpeg.
- נישות: שינה/גשם (שעות מהירות), ג'אז לבית קפה (RPM בינוני), ריכוז, מדיטציה, עונתי; לו-פיי ללימודים תחרות קיצונית; ילדים לא מומלץ.`;

function tutorRules() {
  return `אתה המדריך האישי בקורס "ערוץ מוזיקה מסונו" – קורס בעברית על בניית ערוץ יוטיוב שמפרסם פלייליסטים של מוזיקה שנוצרה ב-Suno, עד מונטיזציה ושכפול לערוצים.
כללים: עונים רק בעברית, בשפה פשוטה, קצר ומעשי (עד 180 מילים אלא אם ביקשו יותר). כשמזכירים כפתור באפליקציה – שם הכפתור באנגלית כפי שמופיע, ותרגום בסוגריים. לא ממציאים נתונים: אם משהו לא ידוע או משתנה – אומרים לבדוק בדף הרשמי. לא נותנים ייעוץ משפטי או מס מחייב. לא ממליצים על שום דבר שמפר את מדיניות יוטיוב או סונו (קניית צפיות, עקיפת חסימות, שמות אמנים, חיקוי קולות).
פרקי הקורס: ${MODULES.map((m, i) => (i + 1) + '. ' + m.title).join(' | ')}.
${COURSE_FACTS}
הפרק שהתלמיד/ה נמצא/ת בו עכשיו: ${(MODULES.find(m => '#' + m.id === location.hash) || MODULES[0]).title}.`;
}
const tutorTurns = [];
function initTutor() {
  const chat = $('#tutorChat');
  const add = (who, t) => { const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = t; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; };
  add('ai', 'שלום! אני המדריך של הקורס. אפשר לשאול אותי כל דבר: איך עושים משהו בסונו, מה כותבים בכותרת, או אם רעיון מסוים מסוכן לערוץ.');
  $('#fab').onclick = () => { $('#drawer').hidden = !$('#drawer').hidden; if (!$('#drawer').hidden) $('#tutorIn').focus(); };
  $('#drawerClose').onclick = () => { $('#drawer').hidden = true; };
  let ctl = null;
  $('#tutorIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#tutorForm').requestSubmit(); } });
  $('#tutorForm').addEventListener('submit', async e => {
    e.preventDefault();
    const q = $('#tutorIn').value.trim(); if (!q) return;
    if (!SAMPLE) { add('ai', 'ה-AI זמין רק כשפותחים את הקורס מתוך Claude. בינתיים אפשר להיעזר בפרקים עצמם.'); return; }
    $('#tutorIn').value = ''; add('me', q);
    tutorTurns.push({ role: 'user', content: q });
    while (tutorTurns.length > 12) tutorTurns.shift();
    if (tutorTurns[0].role !== 'user') tutorTurns.shift();
    const bubble = add('ai', 'חושב…'); $('#tutorSend').disabled = true;
    ctl = new AbortController();
    try {
      const { text } = await SAMPLE([{ role: 'user', content: tutorRules() }, ...tutorTurns], { cache: false, signal: ctl.signal, onText: ({ text }) => { bubble.textContent = text; chat.scrollTop = chat.scrollHeight; } });
      tutorTurns.push({ role: 'assistant', content: text });
    } catch (err) { bubble.textContent = (err.text ? err.text + '\n\n' : '') + aiErr(err); tutorTurns.pop(); }
    finally { $('#tutorSend').disabled = false; }
  });
}

async function boot() {
  initTheme(); initMenu(); renderNav();
  window.addEventListener('hashchange', route);
  route();
  initTutor();
  try {
    if (window.claude && claude.use) {
      const s = await claude.use('sample');
      if (s) { SAMPLE = s; document.dispatchEvent(new Event('ai-ready')); }
    }
  } catch (e) { }
}
