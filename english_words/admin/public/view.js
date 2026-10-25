// בניית כרטיס לכל ילד (פונקציות טהורות – נבדקות בלי דפדפן)
export const PASS = 80;
const STAGES = [['words', 'שלב 1 – מילים'], ['sentences', 'שלב 2 – משפטים']];

// השם מגיע מהאפליקציה של הילד – תמיד לנקות לפני שמציגים
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function when(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stage(s, title) {
  if (!s || !s.attempts) return `<div class="stage"><h3>${title}</h3><p class="muted">עוד לא שיחק</p></div>`;
  const status = s.passed
    ? `<span class="badge good">✅ עבר 80% אחרי ${s.attemptsToPass === 1 ? 'ניסיון אחד' : `${s.attemptsToPass} ניסיונות`}</span>`
    : `<span class="badge wait">⏳ עוד לא הגיע ל-80%</span>`;
  const missed = s.missed.length
    ? `<p class="muted">הכי קשה לו:</p><div class="chips">${s.missed.map((m) => `<span class="chip"><b dir="ltr">${esc(m.en)}</b> ×${m.times}</span>`).join('')}</div>`
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

export function kidHtml(k) {
  const rounds = (k.rounds || []).slice(0, 20).map((r) => `<tr>
      <td>${when(r.at)}</td>
      <td>${r.mode === 'words' ? 'מילים' : 'משפטים'}</td>
      <td>${r.correct}/${r.total}</td>
      <td class="${r.percent >= PASS ? 'ok' : 'no'}">${r.percent}%</td>
    </tr>`).join('');
  return `<article class="card">
    <div class="head">
      <h2>${esc(k.name)}</h2>
      <span class="muted">${k.lastSeen ? 'פעם אחרונה: ' + when(k.lastSeen) : ''}</span>
    </div>
    <div class="stages">${STAGES.map(([m, t]) => stage(k.summary?.[m], t)).join('')}</div>
    ${rounds ? `<details><summary>כל הסיבובים</summary><table><thead><tr><th>מתי</th><th>שלב</th><th>נכון</th><th>אחוז</th></tr></thead><tbody>${rounds}</tbody></table></details>` : ''}
    <button class="link danger" data-delete="${esc(k.id)}" data-name="${esc(k.name)}">מחיקת הילד מהרשימה</button>
  </article>`;
}
