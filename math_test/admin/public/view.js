// בניית כרטיס לכל ילד (פונקציות טהורות – נבדקות בלי דפדפן)
export const PASS = 80;
// פרקים ונושאים – חייב להיות זהה ל-TOPICS ב-web/public/topics.js (בדיקה מוודאת)
export const SECTIONS = [
  ['מספרים טבעיים ופעולות חשבון', [
    ['sequences', '🔢 סדרות'], ['digits', '🧩 בניית מספרים מספרות'], ['ops', '➕ ארבע פעולות החשבון'], ['order', '🧮 סדר פעולות החשבון'],
    ['zero_one', '0️⃣ תכונות האפס והאחד'], ['times_more', '✖️ משמעות הכפל'], ['word_problems', '📖 בעיות מילוליות'], ['write_problem', '✏️ כתיבת שאלה לתרגיל'],
  ]],
  ['שברים פשוטים', [['compare_frac', '⚖️ השוואת שברים'], ['bigger_smaller', '↕️ גדול וקטן משבר נתון'], ['whole_from_part', '🍰 השלמת השלם']]],
  ['מדידות אורכים', [['length', '📏 מדידת אורכים']]],
  ['גיאומטריה', [['parallel', '🛤️ צלעות מקבילות'], ['perimeter', '🔲 היקף מצולעים'], ['area', '🟦 שטחים'], ['angles', '📐 זוויות'], ['diagonals', '❌ אלכסונים']]],
  ['חקר נתונים', [['chart', '📊 דיאגרמות']]],
];
export const EXAM = ['exam', '🎓 מבחן מסכם'];
export const TOPIC_IDS = SECTIONS.flatMap(([, list]) => list.map(([id]) => id));
const TITLE = Object.fromEntries([...SECTIONS.flatMap(([, list]) => list), EXAM]);

// השם והשאלות מגיעים מהאפליקציה של הילד – תמיד לנקות לפני שמציגים
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function when(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// הנושאים הכי קשים: ממוצע נמוך (מי ששוחק), ובמבחן המסכם – אחוז הצלחה נמוך בנושא
export function hardestTopics(summary, limit = 3) {
  const rows = [];
  for (const id of TOPIC_IDS) {
    const s = summary?.[id];
    if (s?.attempts) rows.push({ id, score: s.average, note: `ממוצע ${s.average}%` });
  }
  const sec = summary?.exam?.sections || {};
  for (const [id, { correct, total }] of Object.entries(sec)) {
    if (total < 2 || !TITLE[id]) continue;
    const p = Math.round((correct / total) * 100);
    const row = rows.find((r) => r.id === id);
    if (row) { row.score = Math.min(row.score, p); row.note += ` · במבחן ${p}%`; } else rows.push({ id, score: p, note: `במבחן ${p}%` });
  }
  return rows.filter((r) => r.score < PASS).sort((a, b) => a.score - b.score).slice(0, limit);
}

// השאלות שהכי הרבה פעמים נענו לא נכון (מכל הנושאים)
export function hardestQuestions(summary, limit = 8) {
  const all = [];
  for (const [id, s] of Object.entries(summary || {})) for (const m of s.missed || []) all.push({ id, q: m.q, times: m.times });
  return all.sort((a, b) => b.times - a.times).slice(0, limit);
}

function stage(s, title) {
  if (!s || !s.attempts) return '';
  const status = s.passed
    ? `<span class="badge good">✅ עבר 80% אחרי ${s.attemptsToPass === 1 ? 'ניסיון אחד' : `${s.attemptsToPass} ניסיונות`}</span>`
    : `<span class="badge wait">⏳ עוד לא הגיע ל-80%</span>`;
  const missed = (s.missed || []).length
    ? `<p class="muted">הכי קשה לו:</p><div class="chips">${s.missed.map((m) => `<span class="chip"><b dir="auto">${esc(m.q)}</b> ×${m.times}</span>`).join('')}</div>`
    : '';
  return `<div class="stage">
    <h3>${title}</h3>
    ${status}
    <div class="nums">
      <div><b>${s.attempts}</b><span>ניסיונות</span></div>
      <div><b>${s.best}%</b><span>הכי טוב</span></div>
      <div><b>${s.average}%</b><span>ממוצע</span></div>
      <div><b>${s.last}%</b><span>אחרון</span></div>
    </div>
    ${missed}
  </div>`;
}

function summaryBox(k) {
  const sum = k.summary || {};
  const passed = TOPIC_IDS.filter((id) => sum[id]?.passed).length;
  const played = TOPIC_IDS.filter((id) => sum[id]?.attempts).length;
  const exam = sum.exam?.attempts
    ? (sum.exam.passed ? `✅ עבר את המבחן המסכם אחרי ${sum.exam.attemptsToPass === 1 ? 'ניסיון אחד' : `${sum.exam.attemptsToPass} ניסיונות`}` : `⏳ המבחן המסכם: הכי טוב ${sum.exam.best}%`)
    : 'המבחן המסכם עוד לא נעשה';
  const hard = hardestTopics(sum);
  const hardQ = hardestQuestions(sum);
  return `<div class="summary">
    <p><b>עבר 80% ב-${passed} מתוך ${TOPIC_IDS.length} נושאים</b> (תרגל ${played})</p>
    <p>${exam}</p>
    ${hard.length ? `<p class="muted">הנושאים הכי קשים:</p><div class="chips">${hard.map((h) => `<span class="chip">${TITLE[h.id]} · ${h.note}</span>`).join('')}</div>` : ''}
    ${hardQ.length ? `<p class="muted">השאלות שהכי קשה לו בהן:</p><div class="chips">${hardQ.map((h) => `<span class="chip"><b dir="auto">${esc(h.q)}</b> ×${h.times}</span>`).join('')}</div>` : ''}
  </div>`;
}

export function kidHtml(k) {
  const rounds = (k.rounds || []).slice(0, 20).map((r) => `<tr>
      <td>${when(r.at)}</td>
      <td>${esc(TITLE[r.mode] || r.mode)}</td>
      <td>${r.correct}/${r.total}</td>
      <td class="${r.percent >= PASS ? 'ok' : 'no'}">${r.percent}%</td>
    </tr>`).join('');
  const groups = SECTIONS.map(([name, list]) => {
    const html = list.map(([id, title]) => stage(k.summary?.[id], title)).join('');
    return html ? `<h4 class="sect">${name}</h4>${html}` : '';
  }).join('');
  // סגור כברירת מחדל – רק לחיצה על השם פותחת את כל הנתונים
  return `<details class="card kid" data-id="${esc(k.id)}">
    <summary class="head">
      <h2>${esc(k.name)}</h2>
      <span class="muted">${k.lastSeen ? 'פעם אחרונה: ' + when(k.lastSeen) : ''}</span>
    </summary>
    ${summaryBox(k)}
    <div class="stages">${stage(k.summary?.exam, EXAM[1])}${groups}</div>
    ${rounds ? `<details><summary>כל הסיבובים</summary><table><thead><tr><th>מתי</th><th>נושא</th><th>נכון</th><th>אחוז</th></tr></thead><tbody>${rounds}</tbody></table></details>` : ''}
    <button class="link danger" data-delete="${esc(k.id)}" data-name="${esc(k.name)}">מחיקת הילד מהרשימה</button>
  </details>`;
}
