import { WORDS } from './words.js';
import { SENTENCES } from './sentences.js';
import { report, flush, kidName, setKidName } from './report.js';
import { saidWord, choicesFor, sentenceChoicesFor, nextOrder, shuffle, percent, passed, PASS } from './match.js';

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
// שלב 2 נפתח אחרי 80% במילים; התוצאות הכי טובות נשמרות
let best = load('ew-best', { words: 0, sentences: 0 });
let mode = 'words';
let correct = 0;
let wrong = [];
let order = [];
let index = 0;
let tries = 0;
let firstGuess = true;
let listening = null;

// ---- מסך הבית ----
function showHome() {
  stopListening();
  const n = WORDS.filter((w) => learned[w.en]).length;
  $('count').textContent = `למדתי ${n} מתוך ${WORDS.length} מילים`;
  $('homeStars').textContent = `⭐ ${stars}`;
  $('homeBar').style.width = `${(n / WORDS.length) * 100}%`;
  $('start').textContent = best.words >= PASS ? '🎤 עוד סיבוב מילים' : '🎤 מתחילים!';
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
  $('startSent').textContent = open ? '📖 למשפטים' : '🔒 נפתח אחרי שלב 1';
  $('sentNote').textContent = !open
    ? `קודם עוברים את המילים עם ${PASS}% לפחות`
    : best.sentences ? `התוצאה הכי טובה: ${best.sentences}%${best.sentences >= PASS ? ' 🏆' : ''}` : `${SENTENCES.length} משפטים קצרים – בוחרים את התרגום הנכון`;
  $('list').innerHTML = WORDS.map((w) =>
    `<div class="item ${learned[w.en] ? 'done' : ''}"><b>${w.en}</b><span>${learned[w.en] ? '✓ ' + w.he : ''}</span></div>`
  ).join('');
  show('home');
}

function show(id) {
  for (const s of ['home', 'play', 'result']) $(s).classList.toggle('hidden', s !== id);
  window.scrollTo(0, 0);
}

// ---- מסך התרגול ----
// סיבוב חדש תמיד בסדר אחר
function startPlay(m) {
  mode = m;
  order = mode === 'words' ? nextOrder(WORDS, learned) : shuffle(SENTENCES);
  index = 0;
  correct = 0;
  wrong = [];
  show('play');
  showWord();
}

function showWord() {
  const w = order[index];
  tries = 0;
  firstGuess = true;
  $('pos').textContent = `${index + 1} / ${order.length}`;
  $('stars').textContent = `⭐ ${stars}`;
  $('word').textContent = w.en;
  $('word').classList.toggle('sentence', mode === 'sentences');
  $('hearSent').classList.toggle('hidden', mode !== 'sentences');
  $('pic').textContent = '';
  $('sayMsg').textContent = '';
  $('sayMsg').className = 'msg';
  $('heard').textContent = '';
  $('skipSay').classList.toggle('hidden', !!Recognition);
  $('noMic').classList.toggle('hidden', !!Recognition);
  $('mic').classList.toggle('hidden', !Recognition);
  $('sayStep').classList.remove('hidden');
  $('chooseStep').classList.add('hidden');
  // במשפטים אין קריאה בקול – ישר לתשובות
  if (mode === 'sentences') showChoices();
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
  const w = order[index];
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
  const w = order[index];
  $('sayStep').classList.add('hidden');
  $('chooseStep').classList.remove('hidden');
  $('ask').textContent = mode === 'words' ? 'מה פירוש המילה?' : 'מה פירוש המשפט?';
  $('chooseMsg').textContent = '';
  $('chooseMsg').className = 'msg';
  $('next').classList.add('hidden');
  const box = $('choices');
  box.innerHTML = '';
  const options = mode === 'words' ? choicesFor(w, WORDS) : sentenceChoicesFor(w, SENTENCES);
  for (const he of options) {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = he;
    b.onclick = () => choose(b, he);
    box.appendChild(b);
  }
}

function choose(button, he) {
  const w = order[index];
  if (!$('next').classList.contains('hidden')) return;
  if (he === w.he) {
    button.classList.add('good');
    $('pic').textContent = w.pic || '';
    $('chooseMsg').textContent = firstGuess ? 'נכון! ⭐ קיבלת כוכב' : 'נכון! 👍';
    $('chooseMsg').className = 'msg good';
    if (firstGuess) {
      correct += 1;
      stars += 1;
      if (mode === 'words') learned[w.en] = true;
      save('ew-stars', stars);
      save('ew-learned', learned);
      $('stars').textContent = `⭐ ${stars}`;
    }
    $('next').textContent = index + 1 < order.length ? 'הבאה ←' : 'סיימתי! 🎉';
    $('next').classList.remove('hidden');
  } else {
    if (firstGuess) wrong.push(w.en);
    firstGuess = false;
    button.classList.add('bad');
    button.disabled = true;
    $('chooseMsg').textContent = 'לא נכון, נסה שוב';
    $('chooseMsg').className = 'msg bad';
  }
}

function next() {
  index += 1;
  if (index >= order.length) showResult();
  else showWord();
}

// סוף סיבוב: 80% ומעלה – עוברים הלאה; פחות – עוד פעם מההתחלה בסדר חדש
function showResult() {
  const total = order.length;
  const p = percent(correct, total);
  const ok = passed(correct, total);
  best[mode] = Math.max(best[mode] || 0, p);
  save('ew-best', best);
  report({ mode, correct, total, wrong, at: Date.now() });
  $('resScore').textContent = `צדקת ב-${correct} מתוך ${total} (${p}%)`;
  if (ok && mode === 'words') {
    $('resPic').textContent = '🎉';
    $('resMsg').textContent = 'כל הכבוד! עברת לשלב 2 – משפטים';
    $('resGo').textContent = '📖 לשלב המשפטים';
    $('resGo').onclick = () => startPlay('sentences');
  } else if (ok) {
    $('resPic').textContent = '🏆';
    $('resMsg').textContent = 'מדהים! סיימת גם את המשפטים';
    $('resGo').textContent = '📖 עוד סיבוב משפטים';
    $('resGo').onclick = () => startPlay('sentences');
  } else {
    $('resPic').textContent = '💪';
    $('resMsg').textContent = `צריך ${PASS}% כדי לעבור. עוד פעם מההתחלה – אתה יכול!`;
    $('resGo').textContent = '🔁 עוד פעם';
    $('resGo').onclick = () => startPlay(mode);
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
$('resHome').onclick = showHome;
$('hearSent').onclick = () => speak(order[index].en);
$('back').onclick = showHome;
$('mic').onclick = listen;
$('hear').onclick = () => speak(order[index].en);
$('skipSay').onclick = showChoices;
$('next').onclick = next;
$('reset').onclick = () => {
  if (!confirm('למחוק את ההתקדמות ולהתחיל מההתחלה?')) return;
  learned = {};
  stars = 0;
  best = { words: 0, sentences: 0 };
  save('ew-best', best);
  save('ew-learned', learned);
  save('ew-stars', stars);
  showHome();
};

showHome();
flush();
