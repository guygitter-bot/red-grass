import { report, flush, kidName, setKidName } from './report.js';
import { build } from './gen/index.js';
import { rich, esc } from './rich.js';
import { SECTIONS, TOPICS, TOPIC_IDS, MODE_TITLES, EXAM, PASS, ROUND_SIZE, EXAM_SIZE, topicsOf, isUnlocked, allPassed } from './topics.js';

const $ = (id) => document.getElementById(id);

// התקדמות נשמרת רק בטלפון הזה
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* מצב פרטי */ }
}

let stars = load('cd-stars', 0);
// התוצאה הכי טובה לכל נושא (באחוזים). נושא הבא נפתח אחרי 80%
let best = load('cd-best', {});
let mode = TOPIC_IDS[0];
let seed = 1;
let order = [];
let index = 0;
let correct = 0;
let wrong = [];
let wrongIdx = [];
let bySection = {};
let firstTry = true;
let answered = false;

// סיבוב שלא הסתיים נשמר בטלפון (לכל נושא בנפרד): הזרע מחזיר בדיוק את אותן שאלות
let progress = load('cd-progress', {});
function saveProgress() {
  progress[mode] = { seed, index, total: order.length, correct, wrong, wrongIdx, bySection };
  save('cd-progress', progress);
}
function clearProgress(m) {
  delete progress[m];
  save('cd-progress', progress);
}
function savedRound(m) {
  const p = progress[m];
  const size = m === EXAM ? EXAM_SIZE : ROUND_SIZE;
  return p && Number.isInteger(p.seed) && Number.isInteger(p.index) && p.total === size && p.index >= 0 ? p : null;
}
const resumeText = (m) => {
  const p = savedRound(m);
  return p && p.index > 0 && p.index < p.total ? `${p.index}/${p.total}` : '';
};

const praise = ['נכון! ⭐ קיבלת כוכב', 'יפה מאוד! ⭐', 'מעולה! ⭐', 'כל הכבוד! ⭐', 'בדיוק! ⭐'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- מסך הבית ----
function topicButton(t) {
  const b = document.createElement('button');
  const open = isUnlocked(t.id, best);
  const score = best[t.id];
  const done = score >= PASS;
  const prev = topicsOf(t.section)[topicsOf(t.section).indexOf(t) - 1];
  b.className = `topic${done ? ' passed' : ''}${open ? '' : ' locked'}`;
  b.disabled = !open;
  const status = !open ? `<em>🔒 נפתח אחרי "${esc(prev.title)}"</em>`
    : resumeText(t.id) ? `<em class="going">▶ באמצע: ${resumeText(t.id)}</em>`
    : score ? `<em>${done ? '✅ ' : ''}${score}%</em>` : '';
  b.innerHTML = `<span class="icon">${t.emoji}</span><b>${esc(t.title)}</b><small>${rich(t.note)}</small>${status}`;
  b.onclick = () => startPlay(t.id);
  return b;
}

function showHome() {
  const n = TOPIC_IDS.filter((id) => best[id] >= PASS).length;
  $('overall').textContent = `עברת ${n} מתוך ${TOPIC_IDS.length} נושאים`;
  $('homeStars').textContent = `⭐ ${stars}`;
  $('homeBar').style.width = `${(n / TOPIC_IDS.length) * 100}%`;
  const ready = allPassed(best);
  $('overallNote').textContent = ready ? 'עברת את כל הנושאים! אפשר לגשת למבחן המסכם 🎓' : `צריך ${PASS}% בכל נושא. נושא חדש בכל פרק נפתח אחרי שעוברים את הקודם`;
  const name = kidName();
  $('nameCard').classList.toggle('hidden', !!name);
  $('hello').classList.toggle('hidden', !name);
  $('hello').innerHTML = '';
  if (name) {
    $('hello').append(`שלום ${name}! `);
    const change = document.createElement('button');
    change.textContent = 'זה לא אני';
    change.onclick = () => { $('nameInput').value = name; $('nameCard').classList.remove('hidden'); $('hello').classList.add('hidden'); };
    $('hello').append(change);
  }
  const box = $('sections');
  box.innerHTML = '';
  for (const s of SECTIONS) {
    const card = document.createElement('div');
    card.className = 'card';
    const list = topicsOf(s.id);
    const done = list.filter((t) => best[t.id] >= PASS).length;
    card.innerHTML = `<div class="sechead"><h2>${s.emoji} ${esc(s.title)}</h2><span>${done}/${list.length}</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'topics';
    for (const t of list) grid.appendChild(topicButton(t));
    card.appendChild(grid);
    box.appendChild(card);
  }
  $('examCard').classList.toggle('ready', ready);
  $('startExam').textContent = resumeText(EXAM) ? `▶ ממשיכים במבחן (${resumeText(EXAM)})` : '🎓 למבחן המסכם';
  $('examBest').textContent = best[EXAM] ? `התוצאה הכי טובה: ${best[EXAM]}%${best[EXAM] >= PASS ? ' 🎓' : ''}`
    : `${EXAM_SIZE} שאלות מכל הנושאים, כמו במבחן האמיתי`;
  show('home');
}

function show(id) {
  for (const s of ['home', 'play', 'result']) $(s).classList.toggle('hidden', s !== id);
  window.scrollTo(0, 0);
}

// ---- מסך התרגול ----
// אם יש סיבוב שלא הסתיים – ממשיכים ממנו; אחרת סיבוב חדש עם שאלות חדשות
function startPlay(m, fresh = false) {
  mode = m;
  const saved = fresh ? null : savedRound(m);
  if (saved) {
    ({ seed, index, correct } = saved);
    wrong = saved.wrong || [];
    wrongIdx = saved.wrongIdx || [];
    bySection = saved.bySection || {};
  } else {
    seed = Math.floor(Math.random() * 2 ** 31) + 1;
    index = 0;
    correct = 0;
    wrong = [];
    wrongIdx = [];
    bySection = {};
  }
  order = build(mode, seed);
  if (!saved) saveProgress();
  if (index >= order.length) { showResult(); return; }
  show('play');
  showQuestion();
}

function showQuestion() {
  const q = order[index];
  answered = false;
  firstTry = true;
  $('pos').textContent = `${index + 1} / ${order.length}`;
  $('topicName').textContent = mode === EXAM ? `· ${MODE_TITLES[q.topic]}` : `· ${MODE_TITLES[mode]}`;
  $('stars').textContent = `⭐ ${stars}`;
  $('playBar').style.width = `${(index / order.length) * 100}%`;
  $('qtext').innerHTML = rich(q.text);
  $('expr').textContent = q.expr || '';
  $('expr').classList.toggle('hidden', !q.expr);
  $('fig').innerHTML = q.svg || '';
  $('fig').classList.toggle('hidden', !q.svg);
  $('msg').textContent = '';
  $('msg').className = 'msg';
  $('explain').classList.add('hidden');
  $('next').classList.add('hidden');
  const box = $('choices');
  box.innerHTML = '';
  $('numrow').classList.toggle('hidden', !q.input);
  box.classList.toggle('hidden', !!q.input);
  if (q.input) {
    $('numInput').value = '';
    $('numInput').className = '';
    $('numInput').disabled = false;
    $('numCheck').disabled = false;
    $('numInput').focus();
    return;
  }
  const letters = q.options.every((o) => o.length === 1);
  box.className = `choices${q.options.some((o) => o.length > 16) ? ' one' : ''}`;
  for (const option of q.options) {
    const b = document.createElement('button');
    b.className = `choice${letters ? ' letter' : ''}`;
    b.dataset.value = option;
    b.innerHTML = rich(option);
    b.onclick = () => answer(option, b);
    box.appendChild(b);
  }
}

// תשובה אחת בלבד לכל שאלה: נכון = כוכב; לא נכון = מראים את התשובה הנכונה והסבר, ממשיכים
function answer(value, button) {
  if (answered) return;
  answered = true;
  const q = order[index];
  const ok = value === q.answer;
  const sec = q.topic;
  bySection[sec] = bySection[sec] || { correct: 0, total: 0 };
  bySection[sec].total += 1;
  if (q.input) {
    $('numInput').classList.add(ok ? 'good' : 'bad');
    $('numInput').disabled = true;
    $('numCheck').disabled = true;
  } else {
    for (const b of $('choices').children) {
      b.disabled = true;
      if (b.dataset.value === q.answer) b.classList.add('good');
    }
    if (!ok) button.classList.add('bad');
  }
  if (ok) {
    correct += 1;
    bySection[sec].correct += 1;
    stars += 1;
    save('cd-stars', stars);
    $('stars').textContent = `⭐ ${stars}`;
    $('msg').textContent = pick(praise);
    $('msg').className = 'msg good';
  } else {
    wrong.push(q.key);
    wrongIdx.push(index);
    $('msg').textContent = 'לא נורא, ככה לומדים! 💪';
    $('msg').className = 'msg bad';
    $('explain').innerHTML = `<b>התשובה הנכונה:</b> ${rich(q.answer)}<br>${rich(q.explain)}`;
    $('explain').classList.remove('hidden');
  }
  // התשובה נשמרת מיד – גם אם יוצאים לפני "הבאה", ממשיכים מהשאלה הבאה
  index += 1;
  saveProgress();
  index -= 1;
  $('next').textContent = index + 1 < order.length ? 'הבאה ←' : 'סיימתי! 🎉';
  $('next').classList.remove('hidden');
  $('next').focus();
}

// תשובה מספרית: רק ספרות, בלי פסיקים ורווחים
function checkNumber() {
  if (answered) return;
  const raw = $('numInput').value.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(raw)) { $('numInput').focus(); return; }
  answer(String(Number(raw)), null);
}

function next() {
  index += 1;
  if (index >= order.length) showResult();
  else { window.scrollTo(0, 0); showQuestion(); }
}

// סוף סיבוב: 80% ומעלה – עוברים; פחות – עוד סיבוב עם שאלות חדשות
function showResult() {
  const total = order.length;
  const p = Math.round((correct / total) * 100);
  const ok = correct * 100 >= PASS * total;
  best[mode] = Math.max(best[mode] || 0, p);
  save('cd-best', best);
  clearProgress(mode);
  const sections = mode === EXAM ? Object.fromEntries(Object.entries(bySection).map(([t, s]) => [t, [s.correct, s.total]])) : undefined;
  report({ mode, correct, total, wrong, ...(sections ? { sections } : {}), at: Date.now() });
  $('resScore').textContent = `צדקת ב-${correct} מתוך ${total} (${p}%)`;
  // מה טעו: השאלה והתשובה הנכונה
  const misses = wrongIdx.map((i) => order[i]).filter(Boolean).slice(0, 10);
  $('resMissTitle').classList.toggle('hidden', !misses.length);
  $('resList').innerHTML = misses.map((q) =>
    `<div class="item weak"><span>${q.expr ? `<span class="exp">${esc(q.expr)}</span>` : rich(q.text)}</span><b>${rich(q.answer)}</b></div>`).join('');
  const nextTopic = nextTopicAfter(mode);
  $('resGo').onclick = () => startPlay(mode, true);
  if (ok && mode === EXAM) {
    $('resPic').textContent = '🎓';
    $('resMsg').textContent = 'מעולה! אתה מוכן למבחן';
    $('resGo').textContent = '🔁 עוד מבחן מסכם';
  } else if (ok) {
    $('resPic').textContent = '🏆';
    $('resMsg').textContent = `כל הכבוד! עברת את "${MODE_TITLES[mode]}"`;
    if (nextTopic) {
      $('resGo').textContent = `▶ לנושא הבא: ${nextTopic.title}`;
      $('resGo').onclick = () => startPlay(nextTopic.id, true);
    } else $('resGo').textContent = '🔁 עוד סיבוב';
  } else {
    $('resPic').textContent = '💪';
    $('resMsg').textContent = `צריך ${PASS}% כדי לעבור. עוד סיבוב עם שאלות חדשות – אתה יכול!`;
    $('resGo').textContent = '🔁 עוד פעם';
  }
  $('resMsg').className = ok ? 'msg good' : 'msg';
  show('result');
}

// הנושא שנפתח אחרי שעוברים את הנושא הזה (באותו פרק), אם יש
function nextTopicAfter(id) {
  const t = TOPICS.find((x) => x.id === id);
  if (!t) return null;
  const list = topicsOf(t.section);
  return list[list.indexOf(t) + 1] || null;
}

$('nameSave').onclick = () => {
  const name = $('nameInput').value.trim();
  if (!name) { $('nameInput').focus(); return; }
  setKidName(name);
  showHome();
};
$('nameInput').onkeydown = (e) => { if (e.key === 'Enter') $('nameSave').click(); };
$('startExam').onclick = () => startPlay(EXAM);
$('resHome').onclick = showHome;
$('back').onclick = showHome;
$('next').onclick = next;
$('numCheck').onclick = checkNumber;
$('numInput').onkeydown = (e) => { if (e.key === 'Enter') checkNumber(); };
$('numInput').oninput = (e) => { e.target.value = e.target.value.replace(/[^\d]/g, ''); };
$('reset').onclick = () => {
  if (!confirm('למחוק את ההתקדמות ולהתחיל מההתחלה?')) return;
  stars = 0;
  best = {};
  progress = {};
  save('cd-progress', progress);
  save('cd-best', best);
  save('cd-stars', stars);
  showHome();
};

showHome();
flush();
