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

// ===== המדריך האישי: שיחה שנשמרת, צילומי מסך, והכרות עם ההתקדמות =====
// תמונת מצב של התלמיד/ה מכל מה שנשמר בדפדפן – נשלחת למדריך בכל שאלה
function progressSummary() {
  const cur = MODULES.find(m => '#' + m.id === location.hash) || MODULES.find(m => m.id === store.get('last', 'start')) || MODULES[0];
  const next = MODULES.find(m => !done.has(m.id));
  const lines = [];
  lines.push(`פרקים שהושלמו (${done.size}/${MODULES.length}): ${MODULES.filter(m => done.has(m.id)).map(m => m.title).join(' | ') || 'עוד אין'}.`);
  lines.push(`הפרק הפתוח עכשיו: ${cur.title}.`);
  lines.push(`הפרק הבא שלא הושלם: ${next ? next.title : 'הכול הושלם'}.`);
  const open = [];
  MODULES.forEach(m => { const ck = checks[m.id] || []; m.check.forEach((c, i) => { if (!ck[i] && (m.id === cur.id || done.has(m.id))) open.push(`${m.title}: ${c}`); }); });
  if (open.length) lines.push(`משימות שלא סומנו (בפרק הנוכחי ובפרקים שהושלמו): ${open.slice(0, 12).join(' | ')}.`);
  const nich = store.get('niches', null);
  if (nich && nich.some(x => !x.ex)) lines.push(`נישות שבדק/ה: ${nich.filter(x => !x.ex).map(x => x.n).join(', ')}.`);
  const tr = store.get('track', []);
  if (tr.length) {
    const last = [...tr].sort((x, y) => x.m.localeCompare(y.m)).slice(-3);
    lines.push(`נתוני הערוץ (חודשים אחרונים): ${last.map(r => `${r.m}: ${r.views} צפיות, ${r.hours} שעות, ${r.subs} מנויים, $${r.rev}`).join(' ; ')}.`);
  }
  const pr = store.get('prompt', null);
  if (pr && pr.use) lines.push(`שימוש שנבחר במחולל הפרומפטים: ${pr.use}.`);
  return lines.join('\n');
}
function tutorRules() {
  return `אתה המדריך האישי בקורס "ערוץ מוזיקה מסונו" – קורס בעברית על בניית ערוץ יוטיוב שמפרסם פלייליסטים של מוזיקה שנוצרה ב-Suno, עד מונטיזציה ושכפול לערוצים. התלמיד/ה לא טכני/ת.
איך עובדים: מדריכים יד ביד. צעד אחד או שניים בכל תשובה, בהוראות מדויקות (איפה ללחוץ, מה לכתוב). בסוף כל תשובה – שאלה אחת שבודקת שהצעד בוצע או מה רואים עכשיו על המסך. כשמבקשים "מה הצעד הבא" – מסתכלים על ההתקדמות למטה ומציעים את המשימה הקטנה הבאה, ומפנים לפרק המתאים בקורס.
צילומי מסך: כשמצורף צילום – מתארים בקצרה מה רואים, מסמנים בדיוק על מה ללחוץ (שם הכפתור כפי שמופיע + מיקום: למעלה מימין וכו'), ומזהים טעויות (למשל "Made for kids" מסומן, מסלול חינמי בסונו, כותרת מטעה). אם הצילום לא ברור – מבקשים צילום נוסף.
כללים: עונים רק בעברית פשוטה. שמות כפתורים באנגלית כפי שמופיעים, ותרגום בסוגריים. לא ממציאים נתונים: מה שלא ידוע או משתנה – אומרים לבדוק בדף הרשמי. לא ייעוץ משפטי או מס מחייב. לא ממליצים על שום דבר שמפר את מדיניות יוטיוב או סונו (קניית צפיות, עקיפת חסימות, שמות אמנים, חיקוי קולות). אל תבקש סיסמאות.
פרקי הקורס: ${MODULES.map((m, i) => (i + 1) + '. ' + m.title).join(' | ')}.
${COURSE_FACTS}
ההתקדמות של התלמיד/ה עכשיו:
${progressSummary()}`;
}
// מעט עיצוב בתשובות: **מודגש** ושורות
const mdLite = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>');
let tutorTurns = store.get('tutor', []);
function initTutor() {
  const chat = $('#tutorChat');
  const add = (who, t, imgs) => {
    const d = document.createElement('div'); d.className = 'msg ' + who;
    d.innerHTML = (imgs ? `<div class="thumbs">${imgs.map(u => `<img src="${u}" alt="צילום מסך">`).join('')}</div>` : '') + mdLite(t);
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
  };
  const greet = () => {
    const next = MODULES.find(m => !done.has(m.id));
    add('ai', `שלום! אני המדריך האישי שלך. אני רואה איפה את/ה בקורס${next ? ` – הפרק הבא הוא **${next.title}**` : ''}.\nאפשר לשאול כל שאלה, לשלוח צילום מסך (📷) מסונו או מיוטיוב, או ללחוץ "מה הצעד הבא?" ואוביל אותך צעד אחרי צעד.`);
  };
  const redraw = () => { chat.innerHTML = ''; greet(); tutorTurns.forEach(t => add(t.role === 'user' ? 'me' : 'ai', t.content)); };
  redraw(); window.tutorRedraw = redraw; // לסנכרון: לצייר מחדש אחרי שהגיעו נתונים ממכשיר אחר
  const open = () => { $('#drawer').hidden = false; $('#tutorIn').focus(); chat.scrollTop = chat.scrollHeight; };
  $('#fab').onclick = () => { $('#drawer').hidden ? open() : ($('#drawer').hidden = true); };
  $('#drawerClose').onclick = () => { $('#drawer').hidden = true; };
  // תמונות שמחכות לשליחה
  let pending = [];
  const drawPending = () => {
    $('#tutorPend').innerHTML = pending.map((p, i) => `<span class="pend"><img src="${p.url}" alt=""><button type="button" data-rmimg="${i}" aria-label="הסרת התמונה">✕</button></span>`).join('');
    $('#tutorPend').hidden = !pending.length;
    $$('[data-rmimg]').forEach(b => b.onclick = () => { URL.revokeObjectURL(pending[+b.dataset.rmimg].url); pending.splice(+b.dataset.rmimg, 1); drawPending(); });
  };
  $('#tutorImg').addEventListener('change', e => {
    for (const f of e.target.files) if (/^image\//.test(f.type) && pending.length < 4) pending.push({ file: f, url: URL.createObjectURL(f) });
    e.target.value = ''; drawPending();
  });
  let ctl = null;
  const ask = async (q, shown) => {
    if (!SAMPLE) { add('ai', 'ה-AI לא זמין כאן כרגע. בינתיים אפשר להיעזר בפרקים עצמם.'); return; }
    const imgs = pending; pending = []; drawPending();
    const content = q + (imgs.length ? `\n[צורפו ${imgs.length} צילומי מסך]` : '');
    add('me', shown || q, imgs.map(p => p.url));
    tutorTurns.push({ role: 'user', content });
    const bubble = add('ai', 'חושב…'); $('#tutorSend').disabled = true;
    ctl = new AbortController();
    // שולחים את 20 התורות האחרונות; השיחה כולה נשמרת בטלפון
    let send = tutorTurns.slice(-20); if (send[0].role !== 'user') send = send.slice(1);
    try {
      const opts = { cache: false, signal: ctl.signal, onText: ({ text }) => { bubble.innerHTML = mdLite(text); chat.scrollTop = chat.scrollHeight; } };
      if (imgs.length) opts.images = imgs.map(p => p.file);
      const { text } = await SAMPLE([{ role: 'user', content: tutorRules() }, ...send], opts);
      tutorTurns.push({ role: 'assistant', content: text });
      store.set('tutor', tutorTurns.slice(-60));
    } catch (err) { bubble.textContent = (err.text ? err.text + '\n\n' : '') + aiErr(err); tutorTurns.pop(); }
    finally { $('#tutorSend').disabled = false; }
  };
  $('#tutorIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 640) { e.preventDefault(); $('#tutorForm').requestSubmit(); } });
  $('#tutorForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#tutorIn').value.trim();
    if (!q && !pending.length) return;
    $('#tutorIn').value = '';
    ask(q || 'מה רואים בצילום, ומה עליי לעשות עכשיו?');
  });
  $('#tutorNext').onclick = () => ask('מה הצעד הבא שלי? תן לי משימה אחת קטנה עכשיו, צעד אחרי צעד.', 'מה הצעד הבא שלי?');
  let armed = false;
  $('#tutorNew').onclick = () => {
    if (!armed) { armed = true; $('#tutorNew').textContent = 'למחוק? לחיצה נוספת'; setTimeout(() => { armed = false; $('#tutorNew').textContent = 'שיחה חדשה'; }, 3500); return; }
    armed = false; $('#tutorNew').textContent = 'שיחה חדשה';
    tutorTurns = []; store.set('tutor', []); redraw();
  };
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
