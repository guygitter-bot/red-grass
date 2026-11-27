import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, decodeWords } from './mail/mime.js';
import { Imap } from './mail/imap.js';
import { cleanInvoice } from './mail/extract.js';
import { seal, open } from './mail/secret.js';
import { mailError } from './mail/mailbox.js';
import worker, { Budget } from './worker.js';

const enc = new TextEncoder();
const b64 = (s) => btoa(String.fromCharCode(...enc.encode(s)));

// מייל לדוגמה (נתונים מומצאים): נושא מקודד, HTML, ו-PDF מצורף
const PDF = '%PDF-1.4 fake';
const RAW = [
  'From: =?UTF-8?B?' + b64('חברת דוגמה') + '?= <bill@example.co.il>',
  'Subject: =?UTF-8?B?' + b64('החשבונית שלך לחודש') + '?=',
  'Date: Tue, 03 Nov 2026 08:00:00 +0200',
  'Message-ID: <abc@example>',
  'Content-Type: multipart/mixed; boundary="XX"',
  '',
  '--XX',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<p>=D7=A1=D7=9B=D7=95=D7=9D: 120 =E2=82=AA</p>',
  '--XX',
  'Content-Type: application/pdf; name="inv.pdf"',
  'Content-Disposition: attachment; filename="inv.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  btoa(PDF),
  '--XX--',
  '',
].join('\r\n');

test('פירוק מייל: כותרות, טקסט מתוך HTML ו-PDF', () => {
  const m = parseMail(enc.encode(RAW));
  assert.equal(m.subject, 'החשבונית שלך לחודש');
  assert.match(m.from, /חברת דוגמה/);
  assert.match(m.text, /סכום: 120 ₪/);
  assert.equal(m.pdfs.length, 1);
  assert.equal(atob(m.pdfs[0].data), PDF);
  assert.equal(decodeWords('=?iso-8859-8?Q?=F9=EC=E5=ED?='), 'שלום');
});

test('מייל בעברית ב-8bit ונושא UTF-8 בלי קידוד', () => {
  const raw = enc.encode(['From: בזק <b@bezeq.co.il>', 'Subject: חשבונית בזק לחודש נובמבר', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', 'בחודש זה: ב, ג, ד, ן – סה"כ 89 ₪'].join('\r\n'));
  const m = parseMail(raw);
  assert.equal(m.subject, 'חשבונית בזק לחודש נובמבר');
  assert.match(m.from, /^בזק/);
  assert.match(m.text, /ב, ג, ד, ן – סה"כ 89 ₪/);
});

test('הצפנה של סיסמת האפליקציה', async () => {
  const box = await seal('k1', 'abcd efgh');
  assert.ok(!JSON.stringify(box).includes('abcd'));
  assert.equal(await open('k1', box), 'abcd efgh');
  await assert.rejects(open('k2', box));
});

test('ניקוי חשבונית מה-AI', () => {
  assert.equal(cleanInvoice({ is_invoice: false, supplier: 'x' }), null);
  const inv = cleanInvoice({ is_invoice: true, supplier: ' סלקום ', service: 'סלולר', category: 'תקשורת', amount: '99.834', currency: '₪', invoice_date: '2026-11-03', period_from: 'bad', period_to: '', due_date: '', account: '1', plan: '', items: [{ name: 'אקסטרה', amount: 10 }], notes: '' });
  assert.equal(inv.supplier, 'סלקום');
  assert.equal(inv.amount, 99.83);
  assert.equal(inv.periodFrom, '');
  assert.equal(inv.items[0].name, 'אקסטרה');
  assert.match(mailError(new Error('NO [AUTHENTICATIONFAILED] Invalid credentials')), /לא נכונים/);
});

// שרת IMAP מדומה של Gmail
function fakeGmail({ password = 'apppass1234567890', mails = { 7: RAW, 8: 'From: a@b\r\nSubject: מבצע\r\n\r\nפרסומת' } } = {}) {
  const log = [];
  const connect = () => {
    let push;
    const readable = new ReadableStream({
      start(c) {
        push = (s) => c.enqueue(typeof s === 'string' ? enc.encode(s) : s);
        push('* OK Gimap ready\r\n');
      },
    });
    let pendingLiteral = null;
    let buf = '';
    const writable = new WritableStream({
      write(chunk) {
        const text = new TextDecoder().decode(chunk);
        if (pendingLiteral) {
          pendingLiteral.data += text;
          // סוף הפקודה אחרי ה-literal
          if (pendingLiteral.data.endsWith('\r\n')) {
            pendingLiteral.finish(pendingLiteral.data.slice(0, -2));
            pendingLiteral = null;
          }
          return;
        }
        buf += text;
        while (buf.includes('\r\n')) {
          const line = buf.slice(0, buf.indexOf('\r\n'));
          buf = buf.slice(buf.indexOf('\r\n') + 2);
          const [tag, cmd] = line.split(' ');
          log.push(line.replace(/"[^"]*"\s*$/, '"***"'));
          if (/\{\d+\}$/.test(line)) {
            pendingLiteral = {
              data: '',
              finish: (q) => {
                log.push(`query: ${q}`);
                push(`* SEARCH ${Object.keys(mails).join(' ')}\r\n${tag} OK SEARCH completed\r\n`);
              },
            };
            push('+ go ahead\r\n');
            continue;
          }
          if (cmd === 'LOGIN') push(line.includes(`"${password}"`) ? `${tag} OK logged in\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
          else if (cmd === 'LIST') push(`* LIST (\\HasNoChildren \\All) "/" "[Gmail]/All Mail"\r\n${tag} OK\r\n`);
          else if (cmd === 'SELECT') push(`* 10 EXISTS\r\n${tag} OK [READ-WRITE]\r\n`);
          else if (cmd === 'UID' && line.includes('FETCH')) {
            const uid = line.split(' ')[3];
            const body = enc.encode(mails[uid]);
            push(`* 1 FETCH (UID ${uid} BODY[] {${body.length}}\r\n`);
            push(body);
            push(`)\r\n${tag} OK FETCH completed\r\n`);
          } else if (cmd === 'LOGOUT') push(`* BYE\r\n${tag} OK\r\n`);
          else push(`${tag} OK\r\n`);
        }
      },
    });
    return { readable, writable, close: async () => {} };
  };
  return { connect, log };
}

test('IMAP: התחברות, חיפוש ב-Gmail עם עברית, והורדת מייל', async () => {
  const g = fakeGmail();
  const imap = await Imap.open(g.connect);
  await imap.login('me@gmail.com', 'apppass1234567890');
  assert.equal(await imap.selectAll(), '[Gmail]/All Mail');
  assert.deepEqual(await imap.searchGmail('newer_than:5d חשבונית'), [7, 8]);
  assert.ok(g.log.some((l) => l === 'query: newer_than:5d חשבונית'));
  const raw = await imap.fetch(7);
  assert.equal(new TextDecoder().decode(raw), RAW);
  await imap.logout();
  const bad = await Imap.open(g.connect);
  await assert.rejects(bad.login('me@gmail.com', 'wrong'), /AUTHENTICATIONFAILED/);
});

// ---------- מקצה לקצה דרך השרת ----------

function fakeStorage() {
  const map = new Map();
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    map,
    alarm: null,
    async get(k) {
      return Array.isArray(k) ? new Map(k.filter((kk) => map.has(kk)).map((kk) => [kk, clone(map.get(kk))])) : clone(map.get(k));
    },
    async put(k, v) {
      if (typeof k === 'object') for (const [kk, vv] of Object.entries(k)) map.set(kk, clone(vv));
      else map.set(k, clone(v));
    },
    async delete(k) {
      for (const kk of [k].flat()) map.delete(kk);
    },
    async list({ prefix }) {
      return new Map([...map].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, clone(v)]));
    },
    async setAlarm(t) {
      this.alarm = t;
    },
  };
}

const ORIGIN = 'https://bayit-budget.pages.dev';

test('חיבור Gmail מהאפליקציה ואיסוף חשבוניות', async () => {
  const g = fakeGmail();
  const asked = [];
  const AI_CLIENT = {
    beta: {
      messages: {
        create: async (req) => {
          asked.push(req);
          const text = req.messages[0].content.find((c) => c.type === 'text').text;
          const isInvoice = /החשבונית/.test(text);
          return {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', name: 'record_invoice', input: { is_invoice: isInvoice, supplier: 'חברת דוגמה', service: 'חשמל', category: 'חשבונות הבית', amount: 120, currency: '₪', invoice_date: '2026-11-03', period_from: '', period_to: '', due_date: '', account: '', plan: '', items: [], notes: '' } }],
          };
        },
      },
    },
  };
  const storage = fakeStorage();
  let obj;
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    BUDGET: { idFromName: (n) => n, get: () => ({ fetch: (r) => (obj ||= new Budget({ storage }, { MAIL_KEY: 'secret-key', CONNECT: g.connect, AI_CLIENT, NOW: () => 1_800_000_000_000 })).fetch(r) }) },
  };
  const call = async (path, body = {}, token = '') => {
    const res = await worker.fetch(new Request(`https://api.test${path}`, { method: 'POST', headers: { origin: ORIGIN, authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) }), env);
    return { status: res.status, data: await res.json() };
  };
  const t = (await call('/setup', { password: 'secret123' })).data.token;
  assert.equal((await call('/mail/add', { email: 'me@gmail.com', password: 'xx' }, '')).status, 401);
  assert.equal((await call('/mail/add', { email: 'me@gmail.com', password: 'wrongpass12345' }, t)).status, 400);
  const ok = await call('/mail/add', { email: 'me@gmail.com', password: 'apppass 1234 5678 90' }, t);
  assert.equal(ok.status, 200);
  assert.ok(storage.alarm);
  // הסיסמה לא נשמרת כמו שהיא ולא חוזרת לאפליקציה
  assert.ok(!JSON.stringify([...storage.map.values()]).includes('apppass1234567890'));
  const list = await call('/mail/list', {}, t);
  assert.equal(list.data.accounts[0].email, 'me@gmail.com');
  assert.ok(!('box' in list.data.accounts[0]));

  await obj.alarm();
  assert.equal(asked.length, 2);
  assert.equal(asked[0].model, 'claude-sonnet-5-5');
  // ה-PDF נשלח כמסמך
  assert.ok(asked.some((r) => r.messages[0].content.some((c) => c.type === 'document')));
  const synced = (await call('/sync', { since: 0, changes: [] }, t)).data.changes.filter((r) => r.t === 'invoice');
  assert.equal(synced.length, 1);
  assert.equal(synced[0].supplier, 'חברת דוגמה');
  assert.equal(synced[0].amount, 120);
  assert.equal(synced[0].received, '2026-11-03');
  assert.ok(storage.alarm > 1_800_000_000_000);

  // ריצה חוזרת – מיילים שכבר נקראו לא נשלחים שוב ל-AI
  await obj.alarm();
  assert.equal(asked.length, 2);
  const state = (await call('/mail/list', {}, t)).data.state;
  assert.equal(state.running, false);
  assert.equal((await call('/mail/run', {}, t)).status, 200);
  assert.equal((await call('/mail/remove', { id: list.data.accounts[0].id }, t)).status, 200);
  assert.equal((await call('/mail/list', {}, t)).data.accounts.length, 0);

  // מחיקת כל הנתונים מנתקת גם את התיבות
  await call('/mail/add', { email: 'me@gmail.com', password: 'apppass1234567890' }, t);
  assert.equal((await call('/reset', { password: 'secret123' }, t)).status, 200);
  assert.equal((await call('/mail/list', {}, t)).data.accounts.length, 0);
  assert.ok(![...storage.map.keys()].includes('mail-seen'));
});

test('ריצה ארוכה נעצרת וממשיכה בריצה הבאה, בלי לקרוא שוב את מה שכבר נקרא', async () => {
  const g = fakeGmail();
  let calls = 0;
  const AI_CLIENT = { beta: { messages: { create: async () => { calls += 1; return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'record_invoice', input: { is_invoice: false } }] }; } } } };
  const storage = fakeStorage();
  let time = 1_800_000_000_000;
  // כל קריאה לשעון מקדמת אותו בדקה – אחרי כמה מיילים עובר הזמן של ריצה אחת
  const NOW = () => (time += 60 * 1000);
  const b = new Budget({ storage }, { MAIL_KEY: 'k', CONNECT: g.connect, AI_CLIENT, NOW });
  await b.load();
  const { seal: s2 } = await import('./mail/secret.js');
  await storage.put('mail-accounts', [{ id: 'm1', email: 'me@gmail.com', box: await s2('k', 'apppass1234567890'), firstDone: false }]);
  await b.alarm();
  const first = calls;
  assert.ok(first >= 1);
  const state = await storage.get('mail-state');
  assert.equal(state.running, false);
  if (first < 2) {
    // נשאר מייל – הריצה הבאה נקבעה לעוד דקה
    assert.equal(state.more, true);
    await b.alarm();
  }
  assert.equal(calls, 2);
  await b.alarm();
  assert.equal(calls, 2);
});

test('בלי מפתח הצפנה – חיבור מיילים כבוי', async () => {
  const storage = fakeStorage();
  let obj;
  const env = { ALLOWED_ORIGINS: ORIGIN, BUDGET: { idFromName: (n) => n, get: () => ({ fetch: (r) => (obj ||= new Budget({ storage }, {})).fetch(r) }) } };
  const call = async (path, body = {}, token = '') => {
    const res = await worker.fetch(new Request(`https://api.test${path}`, { method: 'POST', headers: { origin: ORIGIN, authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) }), env);
    return { status: res.status, data: await res.json() };
  };
  const t = (await call('/setup', { password: 'secret123' })).data.token;
  assert.equal((await call('/mail/list', {}, t)).data.enabled, false);
  assert.equal((await call('/mail/add', { email: 'me@gmail.com', password: 'apppass1234567890' }, t)).status, 503);
});
