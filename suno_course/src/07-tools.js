// ===== הכלים האינטראקטיביים =====
const TOOLS = {};
const num = (el) => parseFloat(String(el.value).replace(/,/g, '')) || 0;
const MONTHS_HE = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const ymLabel = (y, m) => `${MONTHS_HE[m]} ${String(y).slice(2)}`;

// גרף SVG פשוט: עמודות + קו + קו סף
function chartSVG({ labels, bars, line, thresholds, barLabel, lineLabel, fmtBar, fmtLine }) {
  const W = 640, H = 240, pl = 48, pr = 48, pt = 16, pb = 34;
  const n = labels.length, iw = W - pl - pr, ih = H - pt - pb, bw = iw / n;
  const maxB = Math.max(1, ...(bars || [0]));
  const maxL = Math.max(1, ...(line || [0]), ...((thresholds || []).map(t => t.v)));
  const yb = v => pt + ih - v / maxB * ih, yl = v => pt + ih - v / maxL * ih;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${barLabel || ''} ${lineLabel || ''}" style="direction:ltr">`;
  for (let i = 0; i <= 4; i++) { const yy = pt + ih * i / 4; s += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>`; }
  if (bars) {
    bars.forEach((v, i) => { const h = pt + ih - yb(v); s += `<rect x="${pl + i * bw + bw * .15}" y="${yb(v)}" width="${bw * .7}" height="${Math.max(0, h)}" rx="2" fill="var(--meter)"><title>${labels[i]}: ${fmtBar ? fmtBar(v) : v}</title></rect>`; });
    s += `<text x="${pl - 6}" y="${pt + 8}" text-anchor="end" font-size="11" fill="var(--muted)">${fmtBar ? fmtBar(maxB) : maxB}</text>`;
  }
  (thresholds || []).forEach(t => { s += `<line x1="${pl}" x2="${W - pr}" y1="${yl(t.v)}" y2="${yl(t.v)}" stroke="var(--bad)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${pl + 4}" y="${yl(t.v) - 5}" font-size="10.5" fill="var(--bad)">סף ${t.label}</text>`; });
  if (line) {
    const pts = line.map((v, i) => `${pl + i * bw + bw / 2},${yl(v)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
    const li = line.length - 1; s += `<circle cx="${pl + li * bw + bw / 2}" cy="${yl(line[li])}" r="4" fill="var(--accent)"/>`;
    s += `<text x="${W - pr + 4}" y="${pt + 8}" font-size="11" fill="var(--accent)">${fmtLine ? fmtLine(maxL) : maxL}</text>`;
  }
  const step = Math.ceil(n / 8);
  labels.forEach((l, i) => { if (i % step === 0) s += `<text x="${pl + i * bw + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)">${l}</text>`; });
  s += `<line x1="${pl}" x2="${W - pr}" y1="${pt + ih}" y2="${pt + ih}" stroke="var(--muted)" stroke-width="1"/></svg>`;
  s += `<div class="row note" style="gap:14px">${bars ? `<span><span style="display:inline-block;width:10px;height:10px;background:var(--meter);border-radius:2px"></span> ${barLabel}</span>` : ''}${line ? `<span><span style="display:inline-block;width:14px;height:3px;background:var(--accent)"></span> ${lineLabel}</span>` : ''}${(thresholds || []).length ? `<span><span style="display:inline-block;width:14px;border-top:2px dashed var(--bad)"></span> סף</span>` : ''}</div>`;
  return s;
}

// ---------- מחשבון הכנסות ----------
const SCEN = {
  pess: { vpw: 2, base: 150, growth: 8, tail: 55, avd: 8, subs: 5, rpm: 1.2 },
  real: { vpw: 2, base: 300, growth: 15, tail: 65, avd: 12, subs: 8, rpm: 2.3 },
  opt: { vpw: 3, base: 600, growth: 22, tail: 75, avd: 18, subs: 12, rpm: 3.8 }
};
TOOLS.calc = el => {
  const st = Object.assign({}, SCEN.real, { months: 24, fx: 3.7, cost: 40, ch: 1, scen: 'real' }, store.get('calc', {}));
  const F = (id, label, val, extra) => `<div class="field"><label for="c_${id}">${label}</label><input id="c_${id}" type="number" inputmode="decimal" value="${val}" ${extra || ''}></div>`;
  el.innerHTML = `<div class="tool">
    <div class="tool-h"><h3>מחשבון הכנסות ותחזית</h3><span class="tag">כלי</span></div>
    <div class="row" role="group" aria-label="תרחיש">${[['pess', 'פסימי'], ['real', 'סביר'], ['opt', 'אופטימי']].map(([k, t]) => `<button class="opt" type="button" data-scen="${k}" aria-pressed="${st.scen === k}">${t}</button>`).join('')}</div>
    <div class="grid4">
      ${F('vpw', 'סרטונים ארוכים בשבוע', st.vpw, 'min="0" step="0.5"')}
      ${F('base', 'צפיות לסרטון בחודש הראשון (בהתחלה)', st.base, 'min="0"')}
      ${F('growth', 'שיפור חודשי בצפיות לסרטון (%)', st.growth)}
      ${F('tail', 'כמה % מהצפיות סרטון שומר כל חודש אחרי', st.tail, 'min="0" max="100"')}
      ${F('avd', 'דקות צפייה ממוצעות לצפייה', st.avd, 'min="0"')}
      ${F('subs', 'מנויים חדשים לכל 1,000 צפיות', st.subs, 'min="0" step="0.5"')}
      ${F('rpm', 'RPM בדולרים', st.rpm, 'min="0" step="0.1"')}
      ${F('cost', 'הוצאות חודשיות ($): סונו + כלים', st.cost, 'min="0"')}
      ${F('months', 'חודשים לתחזית', st.months, 'min="6" max="48"')}
      ${F('fx', 'שער דולר בשקלים', st.fx, 'step="0.01"')}
      ${F('ch', 'מספר ערוצים דומים', st.ch, 'min="1" max="10"')}
    </div>
    <div class="grid4" id="c_stats"></div>
    <div id="c_chart1"></div>
    <div id="c_chart2"></div>
    <p class="note" id="c_note"></p>
  </div>`;
  const ids = ['vpw', 'base', 'growth', 'tail', 'avd', 'subs', 'rpm', 'cost', 'months', 'fx', 'ch'];
  const calc = () => {
    const v = {}; ids.forEach(k => v[k] = num($('#c_' + k, el)));
    v.scen = st.scen; store.set('calc', v);
    const N = Math.min(48, Math.max(6, Math.round(v.months)));
    const now = new Date(); const y0 = now.getFullYear(), m0 = now.getMonth() + 1; // מתחילים בחודש הבא
    const perMonth = v.vpw * 4.33, tail = Math.min(0.98, v.tail / 100);
    const views = [], hours = [], roll = [], subs = [], rev = [], labels = [], thr = [];
    let cum = 0, eligible = -1, approved = -1;
    for (let t = 0; t < N; t++) {
      let vv = 0;
      for (let k = 0; k <= t; k++) vv += perMonth * v.base * Math.pow(1 + v.growth / 100, k) * Math.pow(tail, t - k);
      views.push(vv); hours.push(vv * v.avd / 60);
      roll.push(hours.slice(Math.max(0, t - 11), t + 1).reduce((a, b) => a + b, 0));
      cum += vv * v.subs / 1000; subs.push(cum);
      const d = new Date(y0, m0 + t - 1, 1); labels.push(ymLabel(d.getFullYear(), d.getMonth()));
      const need = d < new Date(2027, 1, 1) ? 4000 : 8000; thr.push(need);
      if (eligible < 0 && cum >= 1000 && roll[t] >= need) { eligible = t; approved = t + 1; }
      rev.push(approved >= 0 && t >= approved ? vv * v.rpm / 1000 : 0);
    }
    const ch = Math.max(1, Math.round(v.ch));
    const totalRev = rev.reduce((a, b) => a + b, 0) * ch;
    const last = rev[N - 1] * ch;
    const net = totalRev - v.cost * N * ch;
    $('#c_stats', el).innerHTML = `
      <div class="stat"><b>${eligible >= 0 ? labels[eligible] : 'לא בטווח'}</b><span>עומדים בתנאי YPP${eligible >= 0 ? ` (חודש ${eligible + 1})` : ''}</span></div>
      <div class="stat"><b>$${fmt(last)}</b><span>הכנסה בחודש האחרון (₪${fmt(last * v.fx)})</span></div>
      <div class="stat"><b>$${fmt(totalRev)}</b><span>סה"כ הכנסה ב-${N} חודשים (₪${fmt(totalRev * v.fx)})</span></div>
      <div class="stat"><b style="color:${net < 0 ? 'var(--bad)' : 'var(--ok)'}">$${fmt(net)}</b><span>אחרי הוצאות (₪${fmt(net * v.fx)})</span></div>`;
    // הגרף הראשון נעצר כמה חודשים אחרי הזכאות, כדי שקו הסף יישאר קריא
    const cut = eligible >= 0 ? Math.min(N, eligible + 4) : N;
    const thrShown = thr.slice(0, cut);
    $('#c_chart1', el).innerHTML = `<h4 style="margin:4px 0">שעות צפייה ב-12 החודשים האחרונים מול הסף${cut < N ? ' (עד כמה חודשים אחרי הזכאות)' : ''}</h4>` + chartSVG({ labels: labels.slice(0, cut), line: roll.slice(0, cut), thresholds: [...(thrShown.includes(4000) ? [{ v: 4000, label: '4,000' }] : []), ...(thrShown.includes(8000) ? [{ v: 8000, label: '8,000 (מ-2.2027)' }] : [])], lineLabel: 'שעות צפייה מצטברות (12 חודשים)', fmtLine: x => fmt(x) });
    $('#c_chart2', el).innerHTML = `<h4 style="margin:4px 0">הכנסה חודשית משוערת${ch > 1 ? ` (${ch} ערוצים)` : ''}</h4>` + chartSVG({ labels, bars: rev.map(x => x * ch), barLabel: 'הכנסה חודשית ($)', fmtBar: x => '$' + fmt(x) });
    const subsAtElig = eligible >= 0 ? fmt(subs[eligible]) : fmt(subs[N - 1]);
    $('#c_note', el).innerHTML = `ההנחות: ${fmt(perMonth, 1)} סרטונים בחודש; כל סרטון ממשיך להביא צפיות שהולכות ופוחתות. מנויים ${eligible >= 0 ? 'בזמן הזכאות' : 'בסוף התקופה'}: ${subsAtElig}. אחרי הזכאות נוסף חודש לבדיקה. מ-1.2.2027 הסף לחדשים הוא 8,000 שעות (לפי דיווחים). הכנסה מוצגת רק מצפיות שאחרי הקבלה, כי צפיות ישנות לא מתוגמלות.`;
  };
  ids.forEach(k => $('#c_' + k, el).addEventListener('input', () => { st.scen = ''; $$('[data-scen]', el).forEach(b => b.setAttribute('aria-pressed', 'false')); calc(); }));
  $$('[data-scen]', el).forEach(b => b.onclick = () => {
    st.scen = b.dataset.scen; const s = SCEN[st.scen];
    Object.keys(s).forEach(k => $('#c_' + k, el).value = s[k]);
    $$('[data-scen]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); calc();
  });
  calc();
};

// ---------- מחשבון הורדות סונו ----------
TOOLS.dlcalc = el => {
  el.innerHTML = `<div class="tool"><div class="tool-h"><h3>כמה הורדות וקרדיטים צריך בחודש?</h3><span class="tag">כלי</span></div>
    <div class="grid4">
      <div class="field"><label for="d_v">סרטונים בחודש</label><input id="d_v" type="number" value="8" min="1"></div>
      <div class="field"><label for="d_h">שעות מוזיקה בסרטון</label><input id="d_h" type="number" value="1" step="0.5" min="0.5"></div>
      <div class="field"><label for="d_t">אורך שיר ממוצע (דקות)</label><input id="d_t" type="number" value="3.5" step="0.5" min="1"></div>
      <div class="field"><label for="d_k">מכל כמה שירים בוחרים אחד</label><input id="d_k" type="number" value="3" min="1"></div>
    </div>
    <div class="grid4" id="d_out"></div><p class="note" id="d_note"></p></div>`;
  const run = () => {
    const v = num($('#d_v', el)), h = num($('#d_h', el)), t = Math.max(1, num($('#d_t', el))), k = Math.max(1, num($('#d_k', el)));
    const dl = Math.ceil(v * h * 60 / t), creates = Math.ceil(dl * k / 2), cr = creates * 10;
    const plan = dl <= 20 && cr <= 2500 ? 'Pro' : dl <= 60 && cr <= 10000 ? 'Premier' : 'Premier + הורדות נוספות';
    $('#d_out', el).innerHTML = `<div class="stat"><b>${fmt(dl)}</b><span>הורדות בחודש</span></div><div class="stat"><b>${fmt(creates)}</b><span>לחיצות Create</span></div><div class="stat"><b>${fmt(cr)}</b><span>קרדיטים (כ-10 ללחיצה)</span></div><div class="stat"><b style="font-family:var(--f-body)">${plan}</b><span>המסלול המתאים</span></div>`;
    $('#d_note', el).textContent = `טיפ: הארכת השירים ל-7 דקות עם Extend מורידה את מספר ההורדות ל-${fmt(Math.ceil(v * h * 60 / 7))}. מכסות: Pro כ-20 הורדות ו-2,500 קרדיטים, Premier כ-60 הורדות ו-10,000 קרדיטים (לבדוק בדף המחירים).`;
  };
  $$('input', el).forEach(i => i.addEventListener('input', run)); run();
};

// ---------- מעבדת נישות ----------
const NICHE_EXAMPLES = [
  { n: 'ג\'אז לבית קפה בגשם', d: 4, c: 3, r: 4, e: 5, p: 4, ex: true },
  { n: 'שינה: פסנתר ורעש גשם 8 שעות', d: 5, c: 2, r: 3, e: 5, p: 3, ex: true },
  { n: 'צ\'יל ים-תיכוני לשבת בבוקר', d: 2, c: 5, r: 3, e: 4, p: 5, ex: true }
];
const CRIT = [['d', 'ביקוש'], ['c', 'מעט מתחרים'], ['r', 'הכנסה לצפייה'], ['e', 'קל לייצר בסונו'], ['p', 'אהבה אישית']];
TOOLS.niche = el => {
  let rows = store.get('niches', null) || NICHE_EXAMPLES.map(x => ({ ...x }));
  const turns = [];
  el.innerHTML = `<div class="tool">
    <div class="tool-h"><h3>סיעור מוחות עם AI</h3><span class="tag">AI</span></div>
    <div class="opts" id="n_chips">${['תציע לי 10 נישות עם תחרות נמוכה והכנסה סבירה', 'אני אוהב/ת טבע וטיולים. אילו נישות מתאימות?', 'תבדוק את הרעיון: ערוץ ג\'אז לבית קפה בגשם', 'אילו נישות עונתיות כדאי להתחיל עכשיו, באוקטובר?', 'איך להבדיל את הערוץ שלי מ-Lofi Girl?'].map(t => `<button type="button" class="opt">${t}</button>`).join('')}</div>
    <div class="chat" id="n_chat"></div>
    <form class="row" id="n_form"><div class="field" style="flex:1"><label for="n_in">מה מעניין אתכם, מה אתם אוהבים לשמוע, או רעיון לבדיקה</label><textarea id="n_in" style="min-height:60px"></textarea></div><button class="btn pri" type="submit">שליחה</button></form>
    <p class="note" id="n_note"></p>
    <hr style="border:0;border-top:1px solid var(--line);width:100%">
    <div class="tool-h"><h3>טבלת ניקוד</h3><span class="tag">כלי</span></div>
    <p class="note">מדרגים 1–5 בכל קריטריון. "ביקוש" ו"הכנסה" שוקלים כפול. כפתור "דירוג AI" ממלא הערכה ראשונית לרעיון. שורות מסומנות "דוגמה" הן להמחשה בלבד.</p>
    <div class="tbl"><table><thead><tr><th>נישה</th>${CRIT.map(c => `<th>${c[1]}</th>`).join('')}<th>ציון</th><th></th></tr></thead><tbody id="n_rows"></tbody></table></div>
    <div class="row"><div class="field" style="flex:1"><label for="n_new">נישה חדשה</label><input id="n_new" placeholder="למשל: פסנתר לקריאה בחורף"></div><button class="btn" type="button" id="n_add">הוספה</button><button class="btn" type="button" id="n_ai">✨ הוספה עם דירוג AI</button></div>
    <p class="note" id="n_ainote"></p>
  </div>`;
  const score = x => Math.round((x.d * 2 + x.c + x.r * 2 + x.e + x.p) / 35 * 100);
  const draw = () => {
    store.set('niches', rows);
    const sorted = rows.map((x, i) => ({ x, i })).sort((a, b) => score(b.x) - score(a.x));
    $('#n_rows', el).innerHTML = sorted.map(({ x, i }) => `<tr><td>${esc(x.n)}${x.ex ? ' <span class="pill y">דוגמה</span>' : ''}${x.why ? `<div class="note">${esc(x.why)}</div>` : ''}</td>${CRIT.map(c => `<td><select aria-label="${c[1]} – ${esc(x.n)}" data-i="${i}" data-k="${c[0]}" style="background:var(--bg);border:1px solid var(--line);border-radius:6px">${[1, 2, 3, 4, 5].map(n => `<option ${x[c[0]] === n ? 'selected' : ''}>${n}</option>`).join('')}</select></td>`).join('')}<td><b class="tnum">${score(x)}</b></td><td><button class="btn sm" type="button" data-del="${i}" aria-label="מחיקה">✕</button></td></tr>`).join('');
    $$('select', $('#n_rows', el)).forEach(s => s.onchange = () => { rows[+s.dataset.i][s.dataset.k] = +s.value; rows[+s.dataset.i].ex = false; draw(); });
    $$('[data-del]', el).forEach(b => b.onclick = () => { rows.splice(+b.dataset.del, 1); draw(); });
  };
  draw();
  $('#n_add', el).onclick = () => { const n = $('#n_new', el).value.trim(); if (!n) return; rows.push({ n, d: 3, c: 3, r: 3, e: 3, p: 3 }); $('#n_new', el).value = ''; draw(); };
  $('#n_ai', el).onclick = async () => {
    const n = $('#n_new', el).value.trim(); if (!n) { $('#n_ainote', el).textContent = 'כתבו קודם את שם הנישה.'; return; }
    if (!SAMPLE) { $('#n_ainote', el).textContent = 'ה-AI זמין רק כשפותחים את הקורס מתוך Claude. אפשר להוסיף ולדרג ידנית.'; return; }
    $('#n_ainote', el).textContent = 'ה-AI מדרג…'; $('#n_ai', el).disabled = true;
    try {
      const j = await SAMPLE.json(`${COURSE_FACTS}\n\nדרג את נישת ערוץ היוטיוב הבאה (מוזיקה שנוצרת בסונו, אוספים ארוכים): "${n}".\nהחזר רק JSON: {"d":1-5 ביקוש,"c":1-5 כמה מעט מתחרים (5=מעט מאוד),"r":1-5 הכנסה לצפייה,"e":1-5 קלות ייצור בסונו,"why":"משפט אחד בעברית עם הסיבה העיקרית והסיכון העיקרי"}`, { modelTier: 'quick' });
      const c = v => Math.min(5, Math.max(1, Math.round(+v || 3)));
      rows.push({ n, d: c(j.d), c: c(j.c), r: c(j.r), e: c(j.e), p: 3, why: String(j.why || '').slice(0, 200) });
      $('#n_new', el).value = ''; $('#n_ainote', el).textContent = 'נוסף. "אהבה אישית" נשאר 3 – רק אתם יודעים.'; draw();
    } catch (e) { $('#n_ainote', el).textContent = aiErr(e); }
    finally { $('#n_ai', el).disabled = false; }
  };
  const chat = $('#n_chat', el);
  const add = (who, t) => { const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = t; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d; };
  add('ai', 'ספרו לי מה אתם אוהבים לשמוע, מה התחביבים שלכם ולאיזה קהל אתם מכוונים (ישראל או העולם). אציע נישות, נבדוק תחרות והכנסה, ונבחר יחד שם ועולם ויזואלי.');
  const RULES = `אתה יועץ אסטרטגיה לערוצי מוזיקה ביוטיוב (מוזיקה מסונו, אוספים ארוכים ופלייליסטים). המטרה: לעזור לבחור נישה שתגיע למונטיזציה הכי מהר ותניב הכנסה, בלי להפר מדיניות.
ענה בעברית פשוטה, קצר ומסודר. כשמציעים נישה: שם הנישה, למי, תחרות (נמוכה/בינונית/גבוהה), הכנסה לצפייה, פוטנציאל שעות צפייה, רעיון לשם ערוץ באנגלית ולעולם ויזואלי, ומילות חיפוש לבדיקה ביוטיוב. סמן הערכות כהערכות. בסוף כל תשובה – שאלה אחת שמקדמת את ההחלטה.
${COURSE_FACTS}`;
  const send = async q => {
    if (!q) return;
    if (!SAMPLE) { $('#n_note', el).textContent = 'ה-AI זמין רק כשפותחים את הקורס מתוך Claude. בינתיים: טבלת הנישות בפרק והשיטה של 30 הדקות.'; return; }
    add('me', q); turns.push({ role: 'user', content: q });
    while (turns.length > 12) turns.shift(); if (turns[0].role !== 'user') turns.shift();
    const b = add('ai', 'חושב…');
    try {
      const { text } = await SAMPLE([{ role: 'user', content: RULES }, ...turns], { cache: false, onText: ({ text }) => { b.textContent = text; chat.scrollTop = chat.scrollHeight; } });
      turns.push({ role: 'assistant', content: text });
    } catch (e) { b.textContent = (e.text ? e.text + '\n\n' : '') + aiErr(e); turns.pop(); }
  };
  $$('#n_chips .opt', el).forEach(b => b.onclick = () => send(b.textContent));
  $('#n_form', el).addEventListener('submit', e => { e.preventDefault(); const q = $('#n_in', el).value.trim(); $('#n_in', el).value = ''; send(q); });
};

// ---------- מחולל פרומפטים ----------
const USES = {
  study: { he: 'לימודים', genre: 'lofi hip hop', bpm: 75, moods: ['cozy', 'focused'], inst: ['mellow Rhodes chords', 'dusty boom-bap drums', 'warm upright bass'], tex: ['vinyl crackle'], use: 'study beats', words: ['Late Night Notes', 'Desk Lamp', 'Quiet Library', 'Margin Notes', 'Pencil Rain', 'Open Book', 'Study Hall', 'Midnight Chapter'] },
  sleep: { he: 'שינה', genre: 'ambient sleep music', bpm: 55, moods: ['calm', 'dreamy'], inst: ['soft felt piano', 'warm evolving pads'], tex: ['gentle rain texture', 'very slow'], use: 'deep sleep', extra: ['no drums', 'no percussion'], words: ['Moonlit Room', 'Slow Tide', 'Soft Blanket', 'Starlight', 'Drifting', 'Night Window', 'Velvet Sky', 'Hush'] },
  focus: { he: 'ריכוז ועבודה', genre: 'deep focus ambient electronic', bpm: 90, moods: ['focused', 'steady'], inst: ['soft synth pluck', 'textured pads', 'steady soft hi-hat'], tex: ['clean minimal mix'], use: 'deep work', words: ['Flow State', 'Clear Mind', 'Workbench', 'Signal', 'Long Hours', 'Grid', 'Momentum', 'Quiet Office'] },
  cafe: { he: 'בית קפה / ג\'אז', genre: 'coffee shop jazz', bpm: 100, moods: ['warm', 'intimate'], inst: ['acoustic piano trio', 'upright bass', 'soft brushed drums'], tex: ['soft swing', 'room ambience'], use: 'café background', words: ['Morning Espresso', 'Corner Table', 'Rainy Café', 'Latte Art', 'Window Seat', 'Sunday Brunch', 'Small Talk', 'Warm Cup'] },
  bossa: { he: 'בוסה נובה', genre: 'bossa nova', bpm: 110, moods: ['relaxed', 'sunny'], inst: ['nylon string guitar', 'light shaker percussion', 'soft flute'], tex: ['warm analog'], use: 'relaxing afternoon', words: ['Seaside Terrace', 'Golden Hour', 'Lazy Afternoon', 'Citrus Breeze', 'Promenade', 'Sun Hat'] },
  meditation: { he: 'מדיטציה', genre: 'meditation ambient', bpm: 60, moods: ['peaceful', 'grounded'], inst: ['singing bowls', 'soft drone', 'gentle chimes'], tex: ['spacious reverb'], use: 'meditation', extra: ['no drums', 'no melody changes'], words: ['Still Water', 'Breath', 'Inner Garden', 'Temple Morning', 'Lotus', 'Silence Between'] },
  workout: { he: 'אימון', genre: 'workout electronic', bpm: 128, moods: ['energetic', 'driving'], inst: ['four-on-the-floor kick', 'punchy bass', 'bright synth lead'], tex: ['build and drop'], use: 'gym training', words: ['Rep Count', 'Heavy Set', 'Sprint', 'Iron', 'Last Round', 'Power Hour'] },
  gaming: { he: 'משחקים / סינת\'ווייב', genre: 'synthwave', bpm: 100, moods: ['nostalgic', 'adventurous'], inst: ['analog arpeggios', 'gated reverb snare', 'warm bass synth'], tex: ['retro 80s'], use: 'gaming session', words: ['Neon Highway', 'Pixel Night', 'Arcade Glow', 'Retro Drive', 'Save Point', 'Level Select'] },
  med: { he: 'צ\'יל ים-תיכוני', genre: 'mediterranean chill instrumental', bpm: 92, moods: ['warm', 'sunny'], inst: ['oud', 'nylon guitar', 'soft darbuka', 'gentle strings'], tex: ['airy mix'], use: 'relaxed morning', words: ['Jaffa Morning', 'Olive Grove', 'Sea Breeze', 'Old Port', 'Lemon Tree', 'Shabbat Light'] },
  piano: { he: 'פסנתר רגוע', genre: 'solo piano', bpm: 65, moods: ['reflective', 'tender'], inst: ['solo felt piano'], tex: ['intimate room reverb', 'rubato'], use: 'reading and relaxing', words: ['First Snow', 'Letters', 'Quiet Morning', 'Old Photographs', 'Rain on Glass', 'Home'] }
};
const MOOD_OPTS = ['calm', 'cozy', 'dreamy', 'nostalgic', 'warm', 'focused', 'melancholic', 'hopeful', 'uplifting', 'mysterious', 'peaceful', 'romantic', 'sunny', 'rainy'];
const INST_OPTS = ['mellow Rhodes', 'soft felt piano', 'upright bass', 'nylon guitar', 'jazzy electric guitar', 'saxophone', 'muted trumpet', 'flute', 'strings', 'warm pads', 'vibraphone', 'kalimba', 'oud', 'harp', 'analog synth', 'brushed drums', 'boom-bap drums', 'soft hand percussion'];
const TEX_OPTS = ['vinyl crackle', 'tape hiss', 'rain ambience', 'room ambience', 'spacious reverb', 'warm analog', 'lo-fi', 'crisp clean mix', 'sidechain pump'];
TOOLS.prompt = el => {
  const st = Object.assign({ use: 'study', moods: [], inst: [], tex: [], bpm: null, extra: '', n: 8 }, store.get('prompt', {}));
  const chips = (key, arr) => `<div class="opts">${arr.map(x => `<button type="button" class="opt" data-k="${key}" data-v="${esc(x)}" aria-pressed="${(st[key] || []).includes(x)}">${x}</button>`).join('')}</div>`;
  el.innerHTML = `<div class="tool">
    <div class="tool-h"><h3>מחולל הפרומפטים</h3><span class="tag">כלי</span></div>
    <div class="field"><label>1. לאיזה שימוש?</label><div class="opts">${Object.entries(USES).map(([k, u]) => `<button type="button" class="opt" data-use="${k}" aria-pressed="${st.use === k}">${u.he}</button>`).join('')}</div></div>
    <div class="field"><label>2. אווירה (עד 2; אם לא בוחרים – ברירת מחדל לפי השימוש)</label>${chips('moods', MOOD_OPTS)}</div>
    <div class="field"><label>3. כלים (3–5; אם לא בוחרים – ברירת מחדל)</label>${chips('inst', INST_OPTS)}</div>
    <div class="field"><label>4. מרקם והפקה</label>${chips('tex', TEX_OPTS)}</div>
    <div class="grid3">
      <div class="field"><label for="p_bpm">קצב (BPM)</label><input id="p_bpm" type="number" min="40" max="180"></div>
      <div class="field"><label for="p_extra">תוספת חופשית (באנגלית)</label><input id="p_extra" placeholder="e.g. 1960s, cinematic" value="${esc(st.extra)}"></div>
      <div class="field"><label for="p_n">כמה וריאציות לפלייליסט</label><input id="p_n" type="number" min="1" max="20" value="${st.n}"></div>
    </div>
    <div id="p_out" style="display:grid;gap:12px"></div>
    <div class="row"><button class="btn pri" type="button" id="p_ai">✨ שיפור והצעות עם AI</button><span class="note" id="p_ainote"></span></div>
    <div id="p_aiout" style="display:grid;gap:10px"></div>
  </div>`;
  const build = () => {
    const u = USES[st.use];
    const bpm = num($('#p_bpm', el)) || u.bpm;
    const moods = (st.moods.length ? st.moods : u.moods).slice(0, 2);
    const inst = (st.inst.length ? st.inst : u.inst).slice(0, 5);
    const tex = st.tex.length ? st.tex : u.tex;
    const extra = $('#p_extra', el).value.trim();
    const core = [u.genre, `${bpm} BPM`, ...inst, ...tex, ...moods, ...(extra ? [extra] : []), ...(u.extra || []), u.use, 'instrumental', 'no vocals'];
    const style = core.join(', ');
    const lyrics = (u.extra || []).includes('no drums') || st.use === 'sleep' ? '[Intro]\n[Instrumental]\n[Interlude]\n[Instrumental]\n[Outro]\n[End]' : '[Intro]\n[Instrumental]\n[Instrumental]\n[Interlude]\n[Instrumental]\n[Outro]\n[End]';
    const exclude = ['vocals', 'singing', 'humming', 'choir', 'rap', ...((u.extra || []).includes('no drums') ? ['drums', 'percussion'] : [])].join(', ');
    // וריאציות: משנים משתנה אחד בכל פעם
    const N = Math.min(20, Math.max(1, Math.round(num($('#p_n', el)) || 1)));
    const altInst = INST_OPTS.filter(x => !inst.includes(x));
    const altMood = MOOD_OPTS.filter(x => !moods.includes(x));
    const keys = ['in A minor', 'in D major', 'in F major', 'in E minor', 'in C major', 'in G minor'];
    const vars = [];
    for (let i = 0; i < N; i++) {
      const kind = i % 3; let p = [...core];
      if (i === 0) { vars.push({ t: u.words[0], p: style }); continue; }
      if (kind === 1) p.splice(2, 1, `${altInst[i % altInst.length]} lead`);
      else if (kind === 2) p.splice(p.indexOf(moods[0]), 1, altMood[i % altMood.length]);
      else p.splice(2, 0, keys[i % keys.length]);
      vars.push({ t: u.words[i % u.words.length] + (i >= u.words.length ? ' II' : ''), p: p.join(', ') });
    }
    store.set('prompt', { use: st.use, moods: st.moods, inst: st.inst, tex: st.tex, extra, n: N });
    $('#p_out', el).innerHTML =
      outBlock(`Styles (סגנון) · ${style.length} תווים`, style) +
      `<div class="grid2">${outBlock('Lyrics (מילים) – רק תגיות', lyrics)}${outBlock('Exclude styles (לא לכלול)', exclude)}</div>` +
      `<div class="note">הגדרות: Instrumental דולק · Weirdness כ-30–40% · Style Influence כ-65–75%.</div>` +
      `<h4 style="margin:6px 0 0">סדרת וריאציות לפלייליסט (${N})</h4><p class="note">אותה "שורת ליבה", ובכל שיר משתנה דבר אחד: כלי מוביל, אווירה או סולם. כך הפלייליסט אחיד אבל לא חוזר על עצמו.</p>` +
      outBlock('כל הווריאציות (כותרת ⇐ פרומפט)', vars.map((v, i) => `${String(i + 1).padStart(2, '0')}. ${v.t}\n${v.p}`).join('\n\n'));
  };
  $('#p_bpm', el).placeholder = USES[st.use].bpm;
  $$('[data-use]', el).forEach(b => b.onclick = () => { st.use = b.dataset.use; $$('[data-use]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('#p_bpm', el).value = ''; $('#p_bpm', el).placeholder = USES[st.use].bpm; build(); });
  $$('[data-k]', el).forEach(b => b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v, arr = st[k]; const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else { const max = k === 'moods' ? 2 : k === 'inst' ? 5 : 3; if (arr.length >= max) arr.shift(); arr.push(v); }
    $$(`[data-k="${k}"]`, el).forEach(x => x.setAttribute('aria-pressed', String(arr.includes(x.dataset.v)))); build();
  });
  ['#p_bpm', '#p_extra', '#p_n'].forEach(s => $(s, el).addEventListener('input', build));
  build();
  $('#p_ai', el).onclick = async () => {
    if (!SAMPLE) { $('#p_ainote', el).textContent = 'ה-AI זמין רק כשפותחים את הקורס מתוך Claude.'; return; }
    const base = $('#p_out .out', el).textContent;
    $('#p_ainote', el).textContent = 'ה-AI עובד…'; $('#p_ai', el).disabled = true;
    try {
      const arr = await SAMPLE.json(`You are an expert Suno (v6) prompt engineer for instrumental YouTube playlist music. Base style prompt:\n"${base}"\nUse case: ${USES[st.use].he} (${USES[st.use].use}).\nWrite 5 improved, distinct style prompts that keep the same channel identity but vary in a musically meaningful way. Rules: English, comma-separated descriptors, 6-12 descriptors, always include a BPM and end with "instrumental, no vocals"; no artist names; no words implying vocals (chant, ooh, anthemic, soulful).\nReturn only JSON: [{"title":"evocative English track title","style":"...","why":"one short Hebrew sentence on what changed"}]`, { cache: false });
      $('#p_aiout', el).innerHTML = (Array.isArray(arr) ? arr : []).slice(0, 5).map(x => outBlock(`${esc(x.title || '')} — ${esc(x.why || '')}`, String(x.style || ''))).join('');
      $('#p_ainote', el).textContent = '';
    } catch (e) { $('#p_ainote', el).textContent = aiErr(e); }
    finally { $('#p_ai', el).disabled = false; }
  };
};

// ---------- ספריית פרומפטים ----------
const LIB = [
  ['לו-פיי', 'lo-fi hip hop, 80 BPM, dusty drum loop, warm upright bass, mellow electric piano chords, vinyl crackle, instrumental, no vocals'],
  ['לו-פיי', 'lofi study beats, 72 BPM, soft Rhodes, muted boom-bap drums, tape hiss, relaxed, focused, instrumental'],
  ['לו-פיי', 'chillhop, 85 BPM, jazzy guitar, vinyl crackle, laid-back drums, warm, nostalgic, instrumental'],
  ['לו-פיי', 'rainy day lo-fi, 70 BPM, felt piano, soft brushed drums, rain ambience, cozy, no vocals'],
  ['שינה ואמביינט', 'ambient drone, 60 BPM, evolving pads, deep sub bass, slow filter sweeps, spacious reverb, calm, instrumental'],
  ['שינה ואמביינט', 'sleep music, 55 BPM, soft piano, warm pads, gentle nature texture, very slow, no drums, no percussion, instrumental'],
  ['שינה ואמביינט', 'nature ambient, 50 BPM, soft pads, gentle wind chimes, distant birds, peaceful, no drums, instrumental'],
  ['ריכוז', 'deep focus ambient, 66 BPM, textured synth pads, soft pulsing arpeggio, minimal, no drums, instrumental'],
  ['ריכוז', 'coding work beats, 90 BPM, minimal electronic, soft pluck, steady hi-hat, clean mix, focused, instrumental'],
  ['מדיטציה', 'meditation, singing bowls, slow breathing pace, soft drone, no melody changes, no vocals'],
  ['ג\'אז', 'smooth jazz, 90 BPM, warm saxophone lead, Rhodes piano, brushed drums, upright bass, late night, instrumental'],
  ['ג\'אז', 'coffee shop jazz, 100 BPM, acoustic piano trio, soft swing, upright bass, intimate, instrumental'],
  ['ג\'אז', 'bossa nova, 110 BPM, nylon guitar, light percussion, relaxed, sunny, instrumental'],
  ['אנרגיה', 'workout electronic, 128 BPM, four-on-the-floor kick, punchy bass, driving synth lead, energetic, build and drop, instrumental'],
  ['אנרגיה', 'gym trap, 140 BPM, heavy 808s, aggressive hi-hats, dark synth stabs, intense, no vocals'],
  ['קולנועי', 'cinematic orchestral, 90 BPM, strings, french horns, powerful timpani, epic, rising tension, instrumental'],
  ['משחקים', 'synthwave, 100 BPM, analog arpeggios, gated reverb snare, neon night drive, retro, instrumental'],
  ['משחקים', 'dark ambient for gaming, 65 BPM, low drones, metallic textures, sparse piano, tense, instrumental'],
  ['אקוסטי', 'acoustic folk instrumental, 95 BPM, fingerpicked guitar, soft strings, warm, hopeful, no vocals'],
  ['פסנתר', 'classical piano, 60 BPM, solo piano, reflective, rubato, intimate room reverb, instrumental']
];
TOOLS.library = el => {
  const cats = [...new Set(LIB.map(x => x[0]))];
  el.innerHTML = `<div class="tool"><div class="tool-h"><h3>ספריית פרומפטים</h3><span class="tag">${LIB.length} פרומפטים</span></div>
    <div class="opts">${['הכול', ...cats].map((c, i) => `<button type="button" class="opt" data-cat="${c}" aria-pressed="${i === 0}">${c}</button>`).join('')}</div>
    <div id="l_list" style="display:grid;gap:10px"></div><p class="note">לכל פרומפט מוסיפים ב-Exclude: vocals, singing, humming, choir, rap. מקור: מדריכי פרומפטים מקצועיים (hookgenius, undetectr, 2026).</p></div>`;
  const draw = c => { $('#l_list', el).innerHTML = LIB.filter(x => c === 'הכול' || x[0] === c).map(x => outBlock(x[0], x[1])).join(''); };
  $$('[data-cat]', el).forEach(b => b.onclick = () => { $$('[data-cat]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(b.dataset.cat); });
  draw('הכול');
};

// ---------- כותרת, תיאור ופרקי זמן ----------
function parseDur(s) { const p = s.split(':').map(Number); if (p.some(isNaN)) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] || 0; }
function ts(sec, long) { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60); const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0'); return long ? `${h}:${mm}:${ss}` : `${mm}:${ss}`; }
TOOLS.meta = el => {
  const st = Object.assign({ theme: 'Rainy Night Lofi', use: 'Study & Relax', emoji: '🌧️', ch: 'Rainy Window', pl: '', tracks: 'Rainy Window | 3:41\nSoft Lamp Light | 3:12\nTea at Midnight | 4:05\nPages Turning | 2:58\nCity Lights Blur | 3:30' }, store.get('meta', {}));
  el.innerHTML = `<div class="tool"><div class="tool-h"><h3>מחולל כותרת, תיאור ופרקי זמן</h3><span class="tag">כלי</span></div>
    <div class="grid2">
      <div class="field"><label for="m_theme">נושא הסרטון (באנגלית)</label><input id="m_theme" value="${esc(st.theme)}"></div>
      <div class="field"><label for="m_use">שימוש</label><input id="m_use" value="${esc(st.use)}" placeholder="Study & Relax / Deep Sleep / Focus"></div>
      <div class="field"><label for="m_ch">שם הערוץ</label><input id="m_ch" value="${esc(st.ch)}"></div>
      <div class="field"><label for="m_emoji">אימוג'י (לא חובה)</label><input id="m_emoji" value="${esc(st.emoji)}"></div>
    </div>
    <div class="field"><label for="m_pl">קישור לפלייליסט (לא חובה)</label><input id="m_pl" value="${esc(st.pl)}" placeholder="https://www.youtube.com/playlist?list=..."></div>
    <div class="field"><label for="m_tracks">רשימת השירים לפי הסדר: שם | אורך (שורה לכל שיר)</label><textarea id="m_tracks" style="min-height:140px;direction:ltr;text-align:left" class="mono">${esc(st.tracks)}</textarea></div>
    <div id="m_out" style="display:grid;gap:12px"></div>
    <div class="row"><button class="btn pri" type="button" id="m_ai">✨ גרסאות נוספות עם AI</button><span class="note" id="m_ainote"></span></div>
    <div id="m_aiout" style="display:grid;gap:10px"></div></div>`;
  const run = () => {
    const v = { theme: $('#m_theme', el).value.trim(), use: $('#m_use', el).value.trim(), ch: $('#m_ch', el).value.trim(), emoji: $('#m_emoji', el).value.trim(), pl: $('#m_pl', el).value.trim(), tracks: $('#m_tracks', el).value };
    store.set('meta', v);
    const list = v.tracks.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)[\s|–-]*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*$/); return m ? { n: m[1].replace(/[|–-]\s*$/, '').trim(), d: parseDur(m[2]) } : { n: l, d: 0 }; });
    const total = list.reduce((a, b) => a + b.d, 0), long = total >= 3600;
    let t = 0; const chapters = list.map(x => { const line = `${ts(t, long)} ${x.n}`; t += x.d; return line; }).join('\n');
    const durTxt = total >= 3600 ? (Math.round(total / 1800) / 2) + (total < 5400 ? ' Hour' : ' Hours') : Math.round(total / 60) + ' Min';
    const e = v.emoji ? ' ' + v.emoji : '';
    const titles = [`${v.theme}${e} ${durTxt} of Chill Beats to ${v.use}`, `${v.use} with ${v.theme}${e} (${durTxt} Playlist)`, `${v.theme}${e} | ${durTxt} ${v.use} Music`];
    const desc = `${v.theme} – ${durTxt.toLowerCase()} of calm, hand-picked instrumental music for ${v.use.toLowerCase()}.\nPut it on, get comfortable, and let the music carry you through.\n\n🎧 Tracklist\n${chapters}\n\n${v.pl ? `▶ More in this mood: ${v.pl}\n\n` : ''}All music created and curated by ${v.ch} using Suno AI (paid plan, commercial license). Visuals created with AI tools and edited by ${v.ch}.\n\n#${v.theme.replace(/[^A-Za-z0-9]/g, '')} #${v.use.split(/\W+/)[0] || 'chill'}music #instrumental`;
    const tags = [v.theme.toLowerCase(), `${v.use.toLowerCase()} music`, 'instrumental', 'chill music', `${durTxt.toLowerCase()} playlist`, v.ch.toLowerCase()].join(', ');
    const errs = [];
    if (list.length < 3) errs.push('צריך לפחות 3 שירים כדי שיוטיוב ייצור פרקים.');
    if (list.some(x => x.d && x.d < 10)) errs.push('כל פרק חייב להיות לפחות 10 שניות.');
    if (list.some(x => !x.d)) errs.push('בחלק מהשורות לא זוהה אורך. כתבו כך: שם | 3:41');
    $('#m_out', el).innerHTML = `<div class="stat"><b>${ts(total, true)}</b><span>אורך כולל · ${list.length} שירים</span></div>` +
      (errs.length ? `<div class="box warn">${errs.join('<br>')}</div>` : '') +
      titles.map((x, i) => outBlock(`כותרת ${i + 1} · ${x.length} תווים${x.length > 100 ? ' – ארוך מדי' : ''}`, x)).join('') +
      outBlock('תיאור (Description)', desc) + outBlock('תגיות (Tags)', tags);
  };
  $$('input,textarea', el).forEach(i => i.addEventListener('input', run)); run();
  $('#m_ai', el).onclick = async () => {
    if (!SAMPLE) { $('#m_ainote', el).textContent = 'ה-AI זמין רק כשפותחים את הקורס מתוך Claude.'; return; }
    $('#m_ainote', el).textContent = 'ה-AI עובד…'; $('#m_ai', el).disabled = true;
    try {
      const j = await SAMPLE.json(`You write YouTube metadata for an instrumental music channel (music made with Suno, curated by a human). Video theme: "${$('#m_theme', el).value}", use case: "${$('#m_use', el).value}", channel: "${$('#m_ch', el).value}".\nFollow YouTube spam policy: honest, no keyword stuffing, no artist names, no false claims (e.g. "no ads"), no medical claims.\nReturn only JSON: {"titles":["5 titles, max 90 chars, mood/use-case first, include duration placeholder {DUR}"],"intro":"2-3 sentence warm description opening in English","pinned":"one friendly pinned-comment question to viewers"}`, { cache: false });
      const dur = $('#m_out .stat b', el).textContent;
      $('#m_aiout', el).innerHTML = outBlock('כותרות', (j.titles || []).map(x => String(x).replace('{DUR}', dur)).join('\n')) + outBlock('פתיחה לתיאור', String(j.intro || '')) + outBlock('תגובה מוצמדת', String(j.pinned || ''));
      $('#m_ainote', el).textContent = '';
    } catch (e) { $('#m_ainote', el).textContent = aiErr(e); }
    finally { $('#m_ai', el).disabled = false; }
  };
};

// ---------- חידון מותר/אסור ----------
const QUIZ = [
  ['להשתמש בשיר שיצרתי בסונו במסלול החינמי, ושדרגתי ל-Pro אחרי שבוע', false, 'שירים מהמסלול החינמי נשארים לא-מסחריים גם אחרי שדרוג.'],
  ['לכתוב בפרומפט "1970s soul, warm Rhodes, tape saturation"', true, 'תיאור של סגנון, תקופה וכלים מותר. אסור רק שם של אמן.'],
  ['להוסיף לסרטון 20 שניות משיר מוכר כ"פתיחה"', false, 'כל מוזיקה של אחרים, גם קצרה, תגרום לתביעה ואולי להתראה.'],
  ['להעלות אותו אוסף שוב עם סדר שירים אחר ותמונה אחרת', false, 'זה בדיוק "תוכן חוזרני". אוסף "Best of" מדי פעם בסדר, אבל לא כשיטה.'],
  ['לרשום את השירים שלי ב-Content ID כדי "להגן" עליהם', false, 'מסוכן: עלול לייצר תביעות על הערוץ שלכם ועל אחרים, ולפי חלק מהמקורות מוזיקת AI טהורה בכלל לא כשירה.'],
  ['להשתמש בתמונה ממוזערת עם "NO ADS" כשיש פרסומות', false, 'הטעיה במטא-דאטה מפרה את מדיניות הספאם וההטעיה.'],
  ['לסמן "Altered content: Yes" בסרטון עם אנימציה מציאותית של AI', true, 'זה בדיוק המקרה שבשבילו הסימון קיים, והוא לא פוגע בהכנסה.'],
  ['לבקש מחברים בקבוצת וואטסאפ להירשם לערוץ', true, 'שיתוף טבעי מותר. אסור "מנוי תמורת מנוי" או קניית מנויים.'],
  ['לפתוח ערוץ חדש אחרי שהערוץ הקודם נסגר על ספאם', false, 'זו עקיפת חסימה ויכולה להפיל את כל הערוצים המקושרים.'],
  ['להפיץ אלבום בספוטיפיי דרך DistroKid עם Content ID מבוטל', true, 'כך המפיץ לא יתבע את הסרטונים שלכם ביוטיוב.']
];
TOOLS.quiz = el => {
  el.innerHTML = `<div class="quiz">${QUIZ.map((q, i) => `<div class="q"><div>${i + 1}. ${q[0]}</div><div class="qa"><button class="btn sm" type="button" data-q="${i}" data-a="1">מותר</button><button class="btn sm" type="button" data-q="${i}" data-a="0">אסור</button></div><div class="res" id="qr${i}"></div></div>`).join('')}<div class="stat"><b id="q_score">0 / ${QUIZ.length}</b><span>תשובות נכונות</span></div></div>`;
  const ans = {};
  $$('[data-q]', el).forEach(b => b.onclick = () => {
    const i = +b.dataset.q, a = b.dataset.a === '1', ok = a === QUIZ[i][1]; ans[i] = ok;
    $('#qr' + i, el).innerHTML = `${ok ? '<span class="pill g">נכון</span>' : '<span class="pill r">לא נכון</span>'} ${QUIZ[i][1] ? 'מותר' : 'אסור'}: ${QUIZ[i][2]}`;
    $('#q_score', el).textContent = `${Object.values(ans).filter(Boolean).length} / ${QUIZ.length}`;
  });
};

// ---------- בדיקה עצמית ----------
const SELF = [
  ['כל השירים נוצרו במסלול בתשלום והורדו מסונו', 3],
  ['האזנתי לכל שיר עד הסוף', 2],
  ['הוויזואל שונה מהסרטונים הקודמים (סצנה חדשה)', 3],
  ['השירים לא הופיעו בסרטון קודם', 3],
  ['הכותרת והתמונה מתארות בדיוק את התוכן', 2],
  ['בתיאור יש רשימת שירים ופרקי זמן', 1],
  ['לא העליתי היום כבר סרטון ארוך אחר', 2],
  ['יש בסרטון נגיעה אישית (סיפור, הערה, עריכה ייחודית)', 2],
  ['סימנתי את שאלת התוכן הסינתטי לפי הצורך', 1],
  ['אין בסרטון שם של אמן או דמות מוגנת', 3]
];
TOOLS.selfcheck = el => {
  el.innerHTML = `<div class="tool"><div class="tool-h"><h3>בדיקה עצמית לפני העלאה</h3><span class="tag">כלי</span></div>
    <ul class="checklist">${SELF.map((s, i) => `<li><label><input type="checkbox" id="sc${i}"> ${s[0]}</label></li>`).join('')}</ul>
    <div class="bar"><span id="sc_bar" style="width:0%"></span></div><div id="sc_res"></div></div>`;
  const total = SELF.reduce((a, s) => a + s[1], 0);
  const run = () => {
    let sc = 0; const miss = [];
    SELF.forEach((s, i) => $('#sc' + i, el).checked ? sc += s[1] : (s[1] >= 3 && miss.push(s[0])));
    const p = Math.round(sc / total * 100); $('#sc_bar', el).style.width = p + '%';
    $('#sc_res', el).innerHTML = miss.length ? `<div class="box bad"><span class="bt">לא להעלות עדיין</span>חסר: ${miss.join(' · ')}</div>` : p >= 85 ? `<div class="box ok"><span class="bt">מוכן להעלאה ✓</span>${p}% מהבדיקה.</div>` : `<div class="box warn"><span class="bt">אפשר, אבל כדאי לשפר</span>${p}% מהבדיקה.</div>`;
  };
  $$('input', el).forEach(i => i.addEventListener('change', run)); run();
};

// ---------- מעקב הערוץ ----------
const TRACK_SAMPLE = [['2026-11', 3200, 410, 85, 0], ['2026-12', 7900, 1150, 160, 0], ['2027-01', 14800, 2300, 290, 0], ['2027-02', 22500, 3600, 410, 0], ['2027-03', 31000, 5100, 520, 31.4], ['2027-04', 38500, 6400, 610, 88.2]].map(r => ({ m: r[0], views: r[1], hours: r[2], subs: r[3], rev: r[4] }));
TOOLS.tracker = el => {
  let rows = [], sample = false, dbRef = null, saving = Promise.resolve();
  el.innerHTML = `<div class="tool">
    <div class="tool-h"><h3>המעקב שלי</h3><span class="tag" id="t_where">שמור בדפדפן הזה</span></div>
    <div class="row"><label class="btn pri" for="t_file" style="cursor:pointer">⬆ העלאת קובץ CSV מהסטודיו</label><input id="t_file" type="file" accept=".csv,text/csv" hidden>
      <div class="field" style="width:150px"><label for="t_now">מנויים כרגע</label><input id="t_now" type="number" min="0"></div>
      <div class="field" style="width:120px"><label for="t_fx">שער דולר</label><input id="t_fx" type="number" step="0.01" value="3.7"></div></div>
    <p class="note" id="t_msg"></p>
    <div class="grid4" id="t_stats"></div>
    <div id="t_chart"></div>
    <div class="tbl"><table><thead><tr><th>חודש</th><th>צפיות</th><th>שעות צפייה</th><th>מנויים חדשים</th><th>הכנסה ($)</th><th>RPM</th><th></th></tr></thead><tbody id="t_rows"></tbody></table></div>
    <form class="grid4" id="t_form" style="align-items:end">
      <div class="field"><label for="t_m">חודש</label><input id="t_m" type="month" required></div>
      <div class="field"><label for="t_v">צפיות</label><input id="t_v" type="number" min="0" required></div>
      <div class="field"><label for="t_h">שעות צפייה</label><input id="t_h" type="number" min="0" step="0.1" required></div>
      <div class="field"><label for="t_s">מנויים חדשים</label><input id="t_s" type="number" required></div>
      <div class="field"><label for="t_r">הכנסה ($)</label><input id="t_r" type="number" min="0" step="0.01" value="0"></div>
      <button class="btn" type="submit">הוספה / עדכון חודש</button>
    </form>
    <div class="row"><button class="btn sm" type="button" id="t_sample">הצגת נתוני דוגמה</button><button class="btn sm" type="button" id="t_clear">מחיקת כל הנתונים</button><span class="note" id="t_confirm"></span></div>
  </div>`;
  const meta = store.get('trackmeta', { now: '', fx: 3.7 });
  $('#t_now', el).value = meta.now; $('#t_fx', el).value = meta.fx;
  const persist = () => {
    if (sample) return;
    store.set('track', rows);
    if (dbRef) saving = saving.then(() => dbRef.set({ rows, now: $('#t_now', el).value, fx: num($('#t_fx', el)) })).catch(() => { $('#t_where', el).textContent = 'שמור בדפדפן הזה'; dbRef = null; });
  };
  const draw = () => {
    const R = [...rows].sort((a, b) => a.m.localeCompare(b.m));
    const fx = num($('#t_fx', el)) || 3.7;
    $('#t_rows', el).innerHTML = R.length ? R.map(r => `<tr><td class="tnum">${r.m}</td><td class="tnum">${fmt(r.views)}</td><td class="tnum">${fmt(r.hours, 1)}</td><td class="tnum">${fmt(r.subs)}</td><td class="tnum">${fmt(r.rev, 2)}</td><td class="tnum">${r.rev && r.views ? '$' + fmt(r.rev / r.views * 1000, 2) : '–'}</td><td>${sample ? '' : `<button class="btn sm" type="button" data-rm="${r.m}" aria-label="מחיקת ${r.m}">✕</button>`}</td></tr>`).join('')
      : `<tr><td colspan="7" class="note">עדיין אין נתונים. מעלים קובץ CSV מהסטודיו או מוסיפים חודש בטופס למטה. אפשר גם להציג נתוני דוגמה כדי לראות איך זה נראה.</td></tr>`;
    $$('[data-rm]', el).forEach(b => b.onclick = () => { rows = rows.filter(r => r.m !== b.dataset.rm); persist(); draw(); });
    const last12 = R.slice(-12);
    const hrs12 = last12.reduce((a, r) => a + r.hours, 0);
    const subsNow = num($('#t_now', el)) || R.reduce((a, r) => a + r.subs, 0);
    const rev = R.reduce((a, r) => a + r.rev, 0);
    const mon = R.filter(r => r.rev > 0), rpm = mon.length ? mon.reduce((a, r) => a + r.rev, 0) / mon.reduce((a, r) => a + r.views, 0) * 1000 : 0;
    const need = new Date() >= new Date(2027, 1, 1) ? 8000 : 4000;
    // תחזית: צמיחה ממוצעת ב-3 החודשים האחרונים
    let proj = '';
    if (R.length >= 3) {
      const l = R.slice(-3); const g = Math.pow(Math.max(1, l[2].views) / Math.max(1, l[0].views), 1 / 2);
      const gg = Math.min(1.5, Math.max(0.8, g)); let v = l[2].views, sum = 0;
      for (let i = 0; i < 6; i++) { v *= gg; sum += v * (rpm || 2.28) / 1000; }
      proj = `<div class="stat"><b>$${fmt(sum)}</b><span>תחזית ל-6 חודשים קדימה (₪${fmt(sum * fx)}), לפי צמיחה של ${fmt((gg - 1) * 100)}% בחודש ו-RPM ${rpm ? 'שלכם' : 'חציוני'}${rpm ? '' : ', אחרי קבלה'}</span></div>`;
    }
    $('#t_stats', el).innerHTML = R.length ? `
      <div class="stat"><b>$${fmt(rev, 2)}</b><span>הרווחתם עד היום (₪${fmt(rev * fx)})</span></div>
      <div class="stat"><b>${fmt(hrs12)} / ${fmt(need)}</b><span>שעות ב-12 החודשים האחרונים (${Math.min(100, Math.round(hrs12 / need * 100))}%)</span></div>
      <div class="stat"><b>${fmt(subsNow)} / 1,000</b><span>מנויים (${Math.min(100, Math.round(subsNow / 10))}%)</span></div>
      ${proj || `<div class="stat"><b>${rpm ? '$' + fmt(rpm, 2) : '–'}</b><span>RPM ממוצע</span></div>`}` : '';
    $('#t_chart', el).innerHTML = R.length ? chartSVG({ labels: R.map(r => r.m.slice(2).replace('-', '/')), bars: R.map(r => r.rev), line: R.map(r => r.hours), barLabel: 'הכנסה ($)', lineLabel: 'שעות צפייה בחודש', fmtBar: x => '$' + fmt(x), fmtLine: x => fmt(x) }) : '';
    $('#t_sample', el).textContent = sample ? 'חזרה לנתונים שלי' : 'הצגת נתוני דוגמה';
    $('#t_msg', el).innerHTML = sample ? '<span class="pill y">נתוני דוגמה</span> אלה לא הנתונים שלכם, ולא נשמרים.' : $('#t_msg', el).innerHTML.replace(/.*נתוני דוגמה.*/, '');
  };
  // ייבוא CSV
  const splitCSV = line => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  $('#t_file', el).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const txt = (await f.text()).replace(/^﻿/, '');
      const lines = txt.split(/\r?\n/).filter(Boolean); const head = splitCSV(lines[0]).map(h => h.toLowerCase());
      const col = re => head.findIndex(h => re.test(h));
      const ci = { d: col(/^(date|day|month|תאריך|חודש)/), v: col(/^views|צפיות/), h: col(/watch time.*hour|שעות/), s: col(/^subscribers|מנויים/), r: col(/estimated revenue|הכנסה/) };
      if (ci.d < 0 || (ci.v < 0 && ci.h < 0 && ci.r < 0)) throw new Error('cols');
      const agg = {};
      lines.slice(1).forEach(l => {
        const c = splitCSV(l); const d = c[ci.d] || ''; const m = d.match(/(\d{4})-(\d{2})/) || d.match(/([A-Za-z]{3})\s+(\d{4})/);
        if (!m) return; let key;
        if (/^\d{4}$/.test(m[1])) key = `${m[1]}-${m[2]}`; else { const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase()); if (mi < 0) return; key = `${m[2]}-${String(mi + 1).padStart(2, '0')}`; }
        const n = i => i < 0 ? 0 : parseFloat(String(c[i] || '0').replace(/[^0-9.\-]/g, '')) || 0;
        const a = agg[key] || (agg[key] = { m: key, views: 0, hours: 0, subs: 0, rev: 0 });
        a.views += n(ci.v); a.hours += n(ci.h); a.subs += n(ci.s); a.rev += n(ci.r);
      });
      const got = Object.values(agg); if (!got.length) throw new Error('rows');
      sample = false;
      got.forEach(g => { const ex = rows.find(r => r.m === g.m); if (ex) { if (ci.v >= 0) ex.views = g.views; if (ci.h >= 0) ex.hours = g.hours; if (ci.s >= 0) ex.subs = g.subs; if (ci.r >= 0) ex.rev = g.rev; } else rows.push(g); });
      persist(); $('#t_msg', el).textContent = `יובאו ${got.length} חודשים מהקובץ.`; draw();
    } catch (err) { $('#t_msg', el).textContent = 'לא הצלחתי לקרוא את הקובץ. צריך קובץ CSV מ-Analytics ← Advanced mode, עם עמודת תאריך (Date) ועמודות כמו Views או Watch time (hours). אפשר גם להוסיף ידנית.'; }
    e.target.value = '';
  });
  $('#t_form', el).addEventListener('submit', e => {
    e.preventDefault(); if (sample) { sample = false; rows = store.get('track', []); }
    const r = { m: $('#t_m', el).value, views: num($('#t_v', el)), hours: num($('#t_h', el)), subs: num($('#t_s', el)), rev: num($('#t_r', el)) };
    rows = rows.filter(x => x.m !== r.m).concat(r); persist(); draw(); e.target.reset();
  });
  ['#t_now', '#t_fx'].forEach(s => $(s, el).addEventListener('change', () => { store.set('trackmeta', { now: $('#t_now', el).value, fx: num($('#t_fx', el)) }); persist(); draw(); }));
  $('#t_sample', el).onclick = () => { sample = !sample; rows = sample ? TRACK_SAMPLE.map(x => ({ ...x })) : store.get('track', []); draw(); };
  let armed = false;
  $('#t_clear', el).onclick = () => {
    if (!armed) { armed = true; $('#t_confirm', el).textContent = 'ללחוץ שוב כדי למחוק הכול.'; setTimeout(() => { armed = false; $('#t_confirm', el).textContent = ''; }, 4000); return; }
    armed = false; sample = false; rows = []; persist(); $('#t_confirm', el).textContent = 'נמחק.'; draw();
  };
  rows = store.get('track', []); draw();
  // שמירה בחשבון (אם זמין): פרטי לכל צופה
  (async () => {
    try {
      if (!window.claude || !claude.use) return;
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!db || !user) return; const uid = await user.id(); if (!uid) return;
      dbRef = db.doc('data/users/' + uid + '/tracker');
      const snap = await dbRef.get();
      if (snap.exists) { const d = snap.data(); if (Array.isArray(d.rows) && !sample) { rows = d.rows.map(r => ({ ...r })); if (d.now != null) $('#t_now', el).value = d.now; if (d.fx) $('#t_fx', el).value = d.fx; store.set('track', rows); draw(); } }
      $('#t_where', el).textContent = 'שמור בחשבון שלכם';
    } catch (e) { dbRef = null; }
  })();
};
