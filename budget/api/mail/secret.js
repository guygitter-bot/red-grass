// הצפנה של סיסמאות האפליקציה (AES-GCM) במפתח שנשמר כסוד של השרת (MAIL_KEY) – לא באחסון ולא במאגר.
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(secret) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`bayit-budget-mail:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), enc.encode(text)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function open(secret, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await key(secret), unb64(box.ct));
  return dec.decode(pt);
}
