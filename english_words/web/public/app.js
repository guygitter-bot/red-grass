import { WORDS } from './words.js';
import { saidWord, choicesFor, nextOrder } from './match.js';

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
  $('start').textContent = n === WORDS.length ? '🎉 למדתי הכול! עוד סיבוב' : '🎤 מתחילים!';
  $('list').innerHTML = WORDS.map((w) =>
    `<div class="item ${learned[w.en] ? 'done' : ''}"><b>${w.en}</b><span>${learned[w.en] ? '✓ ' + w.he : ''}</span></div>`
  ).join('');
  $('home').classList.remove('hidden');
  $('play').classList.add('hidden');
}

// ---- מסך התרגול ----
function startPlay() {
  order = nextOrder(WORDS, learned);
  index = 0;
  $('home').classList.add('hidden');
  $('play').classList.remove('hidden');
  showWord();
}

function showWord() {
  const w = order[index];
  tries = 0;
  firstGuess = true;
  $('pos').textContent = `${index + 1} / ${order.length}`;
  $('stars').textContent = `⭐ ${stars}`;
  $('word').textContent = w.en;
  $('pic').textContent = '';
  $('sayMsg').textContent = '';
  $('sayMsg').className = 'msg';
  $('heard').textContent = '';
  $('skipSay').classList.toggle('hidden', !!Recognition);
  $('noMic').classList.toggle('hidden', !!Recognition);
  $('mic').classList.toggle('hidden', !Recognition);
  $('sayStep').classList.remove('hidden');
  $('chooseStep').classList.add('hidden');
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
  $('chooseMsg').textContent = '';
  $('chooseMsg').className = 'msg';
  $('next').classList.add('hidden');
  const box = $('choices');
  box.innerHTML = '';
  for (const he of choicesFor(w, WORDS)) {
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
    $('pic').textContent = w.pic;
    $('chooseMsg').textContent = firstGuess ? 'נכון! ⭐ קיבלת כוכב' : 'נכון! 👍';
    $('chooseMsg').className = 'msg good';
    if (firstGuess) {
      stars += 1;
      learned[w.en] = true;
      save('ew-stars', stars);
      save('ew-learned', learned);
      $('stars').textContent = `⭐ ${stars}`;
    }
    $('next').textContent = index + 1 < order.length ? 'הבאה ←' : 'סיימתי! 🎉';
    $('next').classList.remove('hidden');
  } else {
    firstGuess = false;
    button.classList.add('bad');
    button.disabled = true;
    $('chooseMsg').textContent = 'לא נכון, נסה שוב';
    $('chooseMsg').className = 'msg bad';
  }
}

function next() {
  index += 1;
  if (index >= order.length) showHome();
  else showWord();
}

$('start').onclick = startPlay;
$('back').onclick = showHome;
$('mic').onclick = listen;
$('hear').onclick = () => speak(order[index].en);
$('skipSay').onclick = showChoices;
$('next').onclick = next;
$('reset').onclick = () => {
  if (!confirm('למחוק את ההתקדמות ולהתחיל מההתחלה?')) return;
  learned = {};
  stars = 0;
  save('ew-learned', learned);
  save('ew-stars', stars);
  showHome();
};

showHome();
