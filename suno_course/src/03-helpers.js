// ===== כלי עזר לבניית איורי מסכים =====
// A(שמאל, למעלה, רוחב, גובה – באחוזים, מחלקה, תוכן, סגנון נוסף)
function A(l, t, w, h, cls, html, st) {
  return `<div class="${cls || ''}" style="position:absolute;left:${l}%;top:${t}%;width:${w}%;height:${h}%;${st || ''}">${html || ''}</div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// איור מסך עם נקודות ממוספרות והסבר מתחת
function mock({ app, url, h, body, pins, cap, wide }) {
  const p = pins || [];
  return `<figure class="shot">
  <div class="frame${wide ? ' fscroll' : ''}" style="${wide ? 'overflow-x:auto' : ''}">
    <div class="chrome"><i></i><i></i><i></i><span class="url">${esc(url)}</span></div>
    <div class="scr ${app}" style="height:${h}px">${body}${p.map((x, i) => `<span class="pin" style="left:calc(${x[0]}% - 12px);top:calc(${x[1]}% - 12px)">${i + 1}</span>`).join('')}</div>
  </div>
  <figcaption><b>איור של המסך</b> (לא צילום) · ${cap}</figcaption>
  ${p.length ? `<ol class="legend">${p.map((x, i) => `<li data-n="${i + 1}"><span>${x[2]}</span></li>`).join('')}</ol>` : ''}
</figure>`;
}

// קופסאות טקסט
const tip = (t, b) => `<div class="box tip"><span class="bt">${t}</span>${b}</div>`;
const warn = (t, b) => `<div class="box warn"><span class="bt">${t}</span>${b}</div>`;
const bad = (t, b) => `<div class="box bad"><span class="bt">${t}</span>${b}</div>`;
const good = (t, b) => `<div class="box ok"><span class="bt">${t}</span>${b}</div>`;
const src = b => `<div class="box src"><b>מקורות ובדיקה:</b> ${b}</div>`;
const steps = arr => `<ol class="steps">${arr.map(s => `<li><div>${s}</div></li>`).join('')}</ol>`;
const yesno = (y, n) => `<div class="two"><div class="yes"><h4>✓ מותר / מומלץ</h4><ul>${y.map(x => `<li>${x}</li>`).join('')}</ul></div><div class="no"><h4>✗ אסור / מסוכן</h4><ul>${n.map(x => `<li>${x}</li>`).join('')}</ul></div></div>`;
const table = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const tool = name => `<div data-tool="${name}"></div>`;
const g = t => `<span class="pill g">${t}</span>`, y = t => `<span class="pill y">${t}</span>`, r = t => `<span class="pill r">${t}</span>`;
// צילום מסך אמיתי (קובץ שמתפרסם לצד הדף)
const shot = (file, url, cap) => `<figure class="shot"><div class="frame"><div class="chrome"><i></i><i></i><i></i><span class="url">${esc(url)}</span></div><img src="img/${file}" alt="${esc(cap.replace(/<[^>]+>/g, ''))}" loading="lazy" style="display:block;width:100%"></div><figcaption><b>צילום מסך אמיתי</b> (20.10.2026) · ${cap}</figcaption></figure>`;
const L = (txt, href) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
