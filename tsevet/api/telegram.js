// שליחה וקבלה מול Telegram (Bot API).
const API = 'https://api.telegram.org';
const MAX_LEN = 3800;

export const tokenOf = (env, agent) => env[`TG_${agent.toUpperCase()}_TOKEN`] || '';
export const botIdOf = (token) => Number(String(token).split(':')[0]) || 0;

// הסיסמה ש-Telegram שולחת בכל עדכון (כדי שרק Telegram יוכל לפנות לשרת)
export async function hookSecret(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tsevet:${token}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

export async function tg(env, token, method, body) {
  const doFetch = env.FETCH || fetch;
  const res = await doFetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(`telegram ${method}: ${data.description || res.status}`);
    err.status = res.status;
    throw err;
  }
  return data.result;
}

// טקסט בסגנון Markdown פשוט -> HTML של Telegram (רק מודגש וקוד)
export function toHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

// הודעה ארוכה -> כמה הודעות (גבול של Telegram), חיתוך בין פסקאות
export function split(text, max = MAX_LEN) {
  const parts = [];
  let rest = String(text).trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function send(env, token, { chat, thread }, text) {
  for (const part of split(text)) {
    const base = { chat_id: chat, ...(thread ? { message_thread_id: thread } : {}), link_preview_options: { is_disabled: true } };
    try {
      await tg(env, token, 'sendMessage', { ...base, text: toHtml(part), parse_mode: 'HTML' });
    } catch {
      // HTML לא תקין – שולחים כטקסט רגיל
      await tg(env, token, 'sendMessage', { ...base, text: part });
    }
  }
}

export async function typing(env, token, { chat, thread }) {
  try {
    await tg(env, token, 'sendChatAction', { chat_id: chat, action: 'typing', ...(thread ? { message_thread_id: thread } : {}) });
  } catch {
    // לא חשוב
  }
}

// תמונה מ-Telegram -> חלק בהודעה ל-Claude
export async function downloadImage(env, token, fileId) {
  const doFetch = env.FETCH || fetch;
  const file = await tg(env, token, 'getFile', { file_id: fileId });
  if (!file?.file_path || file.file_size > 5 * 1024 * 1024) return null;
  const res = await doFetch(`${API}/file/bot${token}/${file.file_path}`);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const ext = file.file_path.split('.').pop().toLowerCase();
  const type = { png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type: type, data: btoa(bin) } };
}
