// הפנייה ל-Claude: שיחה שמסתיימת בכלי אחד (strict), עם הודעות שגיאה בעברית.
export const MODEL = 'claude-opus-5-5';

// שגיאות מ-Anthropic בעברית
export function aiMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (/credit balance|billing|purchase credits/.test(t)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(t)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'הסופר לא הצליח לענות. נסו שוב.';
}

async function ask(env, body) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // אם המודל מסרב – השרת של Anthropic מנסה לבד מודל אחר
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }),
    });
  } catch {
    throw new Error('אין חיבור לסופר כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (!res.ok) {
    // detail = ההודעה של Anthropic עצמה, לאבחון
    const e = new Error(aiMessage(res.status, raw));
    let msg = '';
    try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
    e.detail = `${res.status} ${MODEL}: ${String(msg || raw).replace(/\s+/g, ' ').slice(0, 300)}`;
    throw e;
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('הסופר לא הצליח לענות. נסו שוב.'); }
  if (data.stop_reason === 'refusal') throw new Error('הסופר לא יכול לכתוב על זה. נסו לנסח את התשובות אחרת.');
  return data;
}

// מחזיר את הקלט של הכלי, או null אם Claude לא קרא לו. זורק Error עם הודעה בעברית כשהקריאה עצמה נכשלה.
export async function callTool(env, { system, tool, content, maxTokens = 8000 }) {
  const messages = [{ role: 'user', content }];
  let nudged = false;
  for (let step = 0; step < 3; step++) {
    const data = await ask(env, { max_tokens: maxTokens, system, tools: [tool], messages });
    const got = data.content || [];
    const use = got.find((b) => b.type === 'tool_use' && b.name === tool.name);
    if (use) return use.input || null;
    // Claude ענה בטקסט בלי לקרוא לכלי – מבקשים פעם אחת
    if (data.stop_reason === 'end_turn' && !nudged && got.length) {
      nudged = true;
      messages.push({ role: 'assistant', content: got }, { role: 'user', content: `Now call ${tool.name} with your final answer.` });
      continue;
    }
    break;
  }
  return null;
}
