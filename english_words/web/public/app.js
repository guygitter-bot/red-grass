import { WORDS } from './words.js';
import { SENTENCES } from './sentences.js';
import { report, flush, kidName, setKidName } from './report.js';
import { saidWord, percent, passed, PASS } from './match.js';
import { build, SECTIONS, MODE_TITLES } from './exam.js';

const $ = (id) => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// התקדמות נשמרת רק בטלפון הזה
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* מצב פרטי */ }
}

let learned = load('ew-learned', {});
let stars = load('ew-stars', 0);
// שלב 2 נפתח אחרי 80% במילים; התוצאה הכי טובה נשמרת לכל סוג תרגול
let best = load('ew-best', {});
let mode = 'words';
let correct = 0;
let wrong = [];
let bySection = {};
let order = [];
let index = 0;
let tries = 0;
let firstGuess = true;
let listening = null;

// סיבוב שלא הסתיים נשמר בטלפון (לכל סוג תרגול בנפרד) – גם אם יוצאים, עוברים לתרגול אחר או סוגרים את האפליקציה
let progress = load('ew-progress', {});
function saveProgress() {
  progress[mode] = { order, index, correct, wrong, bySection, firstGuess };
  save('ew-progress', progress);
}
function clearProgress(m) {
  delete progress[m];
  save('ew-progress', progress);
}
function savedRound(m) {
  const p = progress[m];
  return p && Array.isArray(p.order) && p.order.length && Number.isInteger(p.index) ? p : null;
}
// "12/35" לכפתור "ממשיכים"
function resumeText(m) {
  const p = savedRound(m);
  return p ? `${Math.min(p.index, p.order.length)}/${p.order.length}` : '';
}

// תמונה: אימוג'י, או ציור קטן משלנו (svg קבוע מתוך הקוד)
function setPic(el, pic) {
  if (String(pic || '').startsWith('<svg')) el.innerHTML = pic;
  else el.textContent = pic || '';
}

// ---- מסך הבית ----
function showHome() {
  stopListening();
  const n = WORDS.filter((w) => learned[w.en]).length;
  $('count').textContent = `למדתי ${n} מתוך ${WORDS.length} מילים`;
  $('homeStars').textContent = `⭐ ${stars}`;
  $('homeBar').style.width = `${(n / WORDS.length) * 100}%`;
  $('start').textContent = resumeText('words') ? `▶ ממשיכים מאיפה שעצרנו (${resumeText('words')})` : best.words >= PASS ? '🎤 עוד סיבוב מילים' : '🎤 מתחילים!';
  // שם הילד – כדי שבניהול יראו של מי התוצאות
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
  $('wordsBest').textContent = best.words ? `התוצאה הכי טובה: ${best.words}%` : `צריך לצדוק ב-${PASS}% מהמילים כדי לעבור לשלב 2`;
  const open = best.words >= PASS;
  $('startSent').disabled = !open;
  $('startSent').className = open ? 'big' : 'big btn-lock';
  $('startSent').textContent = !open ? '🔒 נפתח אחרי שלב 1' : resumeText('sentences') ? `▶ ממשיכים (${resumeText('sentences')})` : '📖 למשפטים';
  $('sentNote').textContent = !open
    ? `קודם עוברים את המילים עם ${PASS}% לפחות`
    : best.sentences ? `התוצאה הכי טובה: ${best.sentences}%${best.sentences >= PASS ? ' 🏆' : ''}` : `${SENTENCES.length} משפטים קצרים – בוחרים את התרגום הנכון`;
  // תרגול לפי סעיפי המבחן
  $('sections').innerHTML = '';
  for (const s of SECTIONS) {
    const b = document.createElement('button');
    b.className = 'section';
    const score = best[s.mode] ? `<em class="${best[s.mode] >= PASS ? 'ok' : ''}">${best[s.mode]}%${best[s.mode] >= PASS ? ' ✓' : ''}</em>` : '';
    const going = resumeText(s.mode) ? `<em class="going">▶ באמצע: ${resumeText(s.mode)}</em>` : '';
    b.innerHTML = `<span class="icon">${s.icon}</span><b>${s.title}</b><small>${s.note}</small>${going}${score}`;
    b.onclick = () => startPlay(s.mode);
    $('sections').appendChild(b);
  }
  $('startExam').textContent = resumeText('exam') ? `▶ ממשיכים במבחן (${resumeText('exam')})` : '🎓 למבחן לדוגמה';
  $('examBest').textContent = best.exam ? `התוצאה הכי טובה: ${best.exam}%${best.exam >= PASS ? ' 🎓' : ''}` : 'שאלות מכל הסעיפים, כמו במבחן האמיתי';
  $('list').innerHTML = WORDS.map((w) =>
    `<div class="item ${learned[w.en] ? 'done' : ''}"><b class="en">${w.en}</b><span>${learned[w.en] ? '✓ ' + w.he : ''}</span></div>`
  ).join('');
  show('home');
}

function show(id) {
  for (const s of ['home', 'play', 'result']) $(s).classList.toggle('hidden', s !== id);
  window.scrollTo(0, 0);
}

// ---- מסך התרגול ----
// אם יש סיבוב שלא הסתיים – ממשיכים ממנו; אחרת סיבוב חדש, תמיד בסדר אחר
function startPlay(m, fresh = false) {
  mode = m;
  const saved = fresh ? null : savedRound(m);
  if (saved) {
    ({ order, index, correct } = saved);
    wrong = saved.wrong || [];
    bySection = saved.bySection || {};
  } else {
    order = build(mode, { learned });
    index = 0;
    correct = 0;
    wrong = [];
    bySection = {};
    saveProgress();
  }
  if (index >= order.length) { showResult(); return; }
  show('play');
  showQuestion(saved ? saved.firstGuess !== false : true);
}

// keepGuess=false: חוזרים לשאלה שכבר טעו בה – היא כבר לא נחשבת "נכון בפעם הראשונה"
function showQuestion(keepGuess = true) {
  const q = order[index];
  tries = 0;
  firstGuess = keepGuess;
  $('pos').textContent = `${index + 1} / ${order.length}`;
  $('section').textContent = q.section ? MODE_TITLES[q.section] : '';
  $('stars').textContent = `⭐ ${stars}`;
  $('word').textContent = q.text || '';
  $('word').className = `word en ${q.textClass || ''}`;
  setPic($('pic'), q.pic);
  $('hearSent').classList.toggle('hidden', !q.hear || !!q.mic);
  $('hearSent').textContent = q.speak ? '🔊 לשמוע שוב' : '🔊 להקשיב';
  $('sayMsg').textContent = '';
  $('sayMsg').className = 'msg';
  $('heard').textContent = '';
  $('skipSay').classList.toggle('hidden', !!Recognition);
  $('noMic').classList.toggle('hidden', !!Recognition);
  $('mic').classList.toggle('hidden', !Recognition);
  // רק בקריאת מילים אומרים את המילה בקול; בשאר – ישר לתשובות
  if (q.mic) {
    $('sayStep').classList.remove('hidden');
    $('chooseStep').classList.add('hidden');
  } else {
    showChoices();
  }
  if (q.speak) setTimeout(() => speak(q.speak), 300);
}

function speak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.8;
  speechSynthesis.speak(u);
}

function stopListening() {
  if (listening) { try { listening.abort(); } catch { /* כבר נעצר */ } }
  listening = null;
  $('mic').classList.remove('on');
  $('mic').textContent = '🎤 לחץ ותגיד את המילה';
}

function listen() {
  if (listening) { stopListening(); return; }
  const w = order[index].mic;
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.maxAlternatives = 5;
  rec.interimResults = false;
  rec.continuous = false;
  let got = false;
  listening = rec;
  $('mic').classList.add('on');
  $('mic').textContent = '👂 מקשיב...';
  $('sayMsg').textContent = '';
  $('heard').textContent = '';

  rec.onresult = (e) => {
    got = true;
    const heard = [];
    for (const r of e.results) for (const alt of r) heard.push(alt.transcript);
    $('heard').textContent = heard[0] ? `שמעתי: "${heard[0].trim()}"` : '';
    if (saidWord(heard, w)) {
      sayOk();
    } else {
      sayWrong();
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      $('sayMsg').textContent = 'צריך לאשר גישה למיקרופון 🎤';
      $('sayMsg').className = 'msg bad';
      $('skipSay').classList.remove('hidden');
      got = true;
    }
  };
  rec.onend = () => {
    if (listening === rec) stopListening();
    if (!got) {
      $('sayMsg').textContent = 'לא שמעתי... נסה שוב, חזק יותר 🙂';
      $('sayMsg').className = 'msg';
    }
  };
  try { rec.start(); } catch { stopListening(); }
}

function sayOk() {
  $('sayMsg').textContent = 'יופי! קראת נכון 👏';
  $('sayMsg').className = 'msg good';
  setTimeout(showChoices, 700);
}

function sayWrong() {
  tries += 1;
  $('sayMsg').textContent = tries >= 2 ? 'כמעט! לחץ על 🔊 כדי לשמוע, ונסה שוב' : 'כמעט! נסה שוב';
  $('sayMsg').className = 'msg bad';
  // אחרי כמה ניסיונות – אפשר להמשיך בכל זאת (הזיהוי לא תמיד מושלם)
  if (tries >= 3) $('skipSay').classList.remove('hidden');
}

function showChoices() {
  stopListening();
  const q = order[index];
  $('sayStep').classList.add('hidden');
  $('chooseStep').classList.remove('hidden');
  $('ask').textContent = q.ask;
  $('chooseMsg').textContent = '';
  $('chooseMsg').className = 'msg';
  $('next').classList.add('hidden');
  const box = $('choices');
  box.innerHTML = '';
  box.className = `choices ${q.style}`;
  for (const option of q.options) {
    const b = document.createElement('button');
    b.className = `choice ${q.style}`;
    b.textContent = option;
    b.onclick = () => choose(b, option);
    box.appendChild(b);
  }
}

function choose(button, option) {
  const q = order[index];
  if (!$('next').classList.contains('hidden')) return;
  const sec = q.section || mode;
  bySection[sec] = bySection[sec] || { correct: 0, total: 0 };
  if (option === q.answer) {
    button.classList.add('good');
    if (q.reward) setPic($('pic'), q.reward);
    if (q.reveal) $('word').textContent = q.reveal;
    $('chooseMsg').textContent = firstGuess ? 'נכון! ⭐ קיבלת כוכב' : 'נכון! 👍';
    $('chooseMsg').className = 'msg good';
    if (firstGuess) {
      correct += 1;
      bySection[sec].correct += 1;
      stars += 1;
      if (q.mic) learned[q.key] = true;
      save('ew-stars', stars);
      save('ew-learned', learned);
      $('stars').textContent = `⭐ ${stars}`;
    }
    bySection[sec].total += 1;
    // התשובה נשמרת מיד – גם אם יוצאים לפני "הבאה", ממשיכים מהשאלה הבאה
    index += 1;
    firstGuess = true;
    saveProgress();
    index -= 1;
    $('next').textContent = index + 1 < order.length ? 'הבאה ←' : 'סיימתי! 🎉';
    $('next').classList.remove('hidden');
  } else {
    if (firstGuess) wrong.push(q.key);
    firstGuess = false;
    button.classList.add('bad');
    button.disabled = true;
    saveProgress();
    $('chooseMsg').textContent = 'לא נכון, נסה שוב';
    $('chooseMsg').className = 'msg bad';
  }
}

function next() {
  index += 1;
  if (index >= order.length) showResult();
  else showQuestion();
}

// סוף סיבוב: 80% ומעלה – עוברים; פחות – עוד פעם מההתחלה בסדר חדש
function showResult() {
  const total = order.length;
  const p = percent(correct, total);
  const ok = passed(correct, total);
  best[mode] = Math.max(best[mode] || 0, p);
  save('ew-best', best);
  clearProgress(mode);
  report({ mode, correct, total, wrong, at: Date.now() });
  $('resScore').textContent = `צדקת ב-${correct} מתוך ${total} (${p}%)`;
  // במבחן לדוגמה: איך הלך בכל סעיף
  $('resList').innerHTML = mode !== 'exam' ? '' : Object.entries(bySection).map(([m, s]) =>
    `<div class="item ${passed(s.correct, s.total) ? 'done' : 'weak'}"><span>${MODE_TITLES[m]}</span><b>${s.correct}/${s.total}</b></div>`
  ).join('');
  $('resGo').onclick = () => startPlay(mode, true);
  if (ok && mode === 'words') {
    $('resPic').textContent = '🎉';
    $('resMsg').textContent = 'כל הכבוד! עברת לשלב 2 – משפטים';
    $('resGo').textContent = '📖 לשלב המשפטים';
    $('resGo').onclick = () => startPlay('sentences', true);
  } else if (ok && mode === 'exam') {
    $('resPic').textContent = '🎓';
    $('resMsg').textContent = 'מעולה! אתה מוכן למבחן';
    $('resGo').textContent = '🔁 עוד מבחן לדוגמה';
  } else if (ok) {
    $('resPic').textContent = '🏆';
    $('resMsg').textContent = `כל הכבוד! עברת את "${MODE_TITLES[mode]}"`;
    $('resGo').textContent = '🔁 עוד סיבוב';
  } else {
    $('resPic').textContent = '💪';
    $('resMsg').textContent = `צריך ${PASS}% כדי לעבור. עוד פעם מההתחלה – אתה יכול!`;
    $('resGo').textContent = '🔁 עוד פעם';
  }
  $('resMsg').className = ok ? 'msg good' : 'msg';
  show('result');
}

$('nameSave').onclick = () => {
  const name = $('nameInput').value.trim();
  if (!name) { $('nameInput').focus(); return; }
  setKidName(name);
  showHome();
};
$('nameInput').onkeydown = (e) => { if (e.key === 'Enter') $('nameSave').click(); };
$('start').onclick = () => startPlay('words');
$('startSent').onclick = () => startPlay('sentences');
$('startExam').onclick = () => startPlay('exam');
$('resHome').onclick = showHome;
$('hearSent').onclick = () => speak(order[index].hear);
$('back').onclick = showHome;
$('mic').onclick = listen;
$('hear').onclick = () => speak(order[index].text);
$('skipSay').onclick = showChoices;
$('next').onclick = next;
$('reset').onclick = () => {
  if (!confirm('למחוק את ההתקדמות ולהתחיל מההתחלה?')) return;
  learned = {};
  stars = 0;
  best = {};
  progress = {};
  save('ew-progress', progress);
  save('ew-best', best);
  save('ew-learned', learned);
  save('ew-stars', stars);
  showHome();
};

showHome();
flush();
