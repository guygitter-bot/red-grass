// חיבור תיבות Gmail ואיסוף חשבוניות: חשבונות (מייל + סיסמת אפליקציה מוצפנת), ריצה יומית (alarm) או בלחיצה,
// חיפוש מיילים של חשבוניות, קריאה עם Claude ושמירה כרשומות invoice שמסתנכרנות לאפליקציה.
import { Imap } from './imap.js';
import { parseMail } from './mime.js';
import { extractInvoice } from './extract.js';
import { open, seal } from './secret.js';

const MAX_ACCOUNTS = 6;
const FIRST_DAYS = 180;
const NEXT_DAYS = 14;
const PER_RUN = 40;
const AI_PER_DAY = 150;
const MAX_MAIL_BYTES = 12_000_000;
const SEEN_KEEP = 6000;
// ריצה אחת לא יותר מ-5 דקות; מה שנשאר ממשיך בריצה הבאה (דקה אחרי)
const RUN_MS = 5 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const QUERY = (days) => `newer_than:${days}d (חשבונית OR "חשבונית מס" OR קבלה OR invoice OR receipt OR "דרישת תשלום" OR "חשבון לתקופה" OR "פירוט חיובים" OR "החשבון שלך" OR "חיוב חודשי")`;

const fail = (status, error) => Object.assign(new Error(error), { status });
const isGmail = (email) => /^[^\s@]+@(gmail\.com|googlemail\.com)$/i.test(email) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function hash(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}

// הודעת שגיאה מובנת מ-IMAP
export function mailError(err) {
  const m = String(err?.message || err);
  if (/AUTHENTICATIONFAILED|Invalid credentials|LOGIN/i.test(m)) return 'המייל או סיסמת האפליקציה לא נכונים (או שהסיסמה בוטלה בגוגל)';
  if (/ALERT|IMAP.*disabled|Web login required/i.test(m)) return 'גוגל חוסמת את החיבור – לבדוק שאימות דו-שלבי פעיל ושסיסמת האפליקציה חדשה';
  if (/timeout|closed|connect/i.test(m)) return 'לא הצלחתי להתחבר לגוגל. ננסה שוב בפעם הבאה';
  return 'תקלה בקריאת המיילים';
}

export class Mailbox {
  // host: { storage, env, now, putRecords(list) }
  constructor(host) {
    this.storage = host.storage;
    this.env = host.env;
    this.now = host.now;
    this.putRecords = host.putRecords;
  }

  get ready() {
    return !!this.env.MAIL_KEY;
  }

  async connect() {
    if (this.env.CONNECT) return this.env.CONNECT;
    const sockets = await import('cloudflare:sockets');
    return sockets.connect;
  }

  async accounts() {
    return (await this.storage.get('mail-accounts')) || [];
  }

  async state() {
    return (await this.storage.get('mail-state')) || {};
  }

  // רשימה לאפליקציה – בלי הסיסמאות
  async list() {
    const accounts = (await this.accounts()).map(({ box, ...a }) => a);
    return { enabled: this.ready, accounts, state: await this.state() };
  }

  async withTimeout(promise, ms, what) {
    let timer;
    const t = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error(`timeout ${what}`)), ms);
    });
    try {
      return await Promise.race([promise, t]);
    } finally {
      clearTimeout(timer);
    }
  }

  async add({ email, password }) {
    if (!this.ready) throw fail(503, 'חיבור מיילים עוד לא הופעל בשרת');
    email = String(email || '').trim().toLowerCase();
    password = String(password || '').replace(/\s+/g, '');
    if (!isGmail(email)) throw fail(400, 'כתובת מייל לא תקינה');
    if (password.length < 8) throw fail(400, 'סיסמת האפליקציה צריכה להיות 16 תווים');
    const list = await this.accounts();
    if (list.length >= MAX_ACCOUNTS && !list.some((a) => a.email === email)) throw fail(400, 'אפשר לחבר עד 6 תיבות');
    // בודקים שהחיבור עובד לפני ששומרים
    const imap = await this.withTimeout(Imap.open(await this.connect()), 20000, 'connect').catch((e) => {
      throw fail(502, mailError(e));
    });
    try {
      await this.withTimeout(imap.login(email, password), 20000, 'login');
    } catch (e) {
      throw fail(400, mailError(e));
    } finally {
      await imap.logout();
    }
    const box = await seal(this.env.MAIL_KEY, password);
    const old = list.find((a) => a.email === email);
    const account = { id: old?.id || `m${hash(email)}`, email, box, added: this.now(), lastRun: 0, lastError: '', found: old?.found || 0, firstDone: old?.firstDone || false };
    await this.storage.put('mail-accounts', [...list.filter((a) => a.email !== email), account]);
    // ריצה ראשונה מיד (ברקע)
    return { ok: true, id: account.id };
  }

  async remove({ id }) {
    const list = await this.accounts();
    await this.storage.put('mail-accounts', list.filter((a) => a.id !== id));
    return { ok: true };
  }

  // מכסה יומית לקריאות AI
  async takeAi() {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const usage = (await this.storage.get('mail-ai')) || {};
    if (usage.day !== day) Object.assign(usage, { day, count: 0 });
    if (usage.count >= AI_PER_DAY) return false;
    usage.count += 1;
    await this.storage.put('mail-ai', usage);
    return true;
  }

  // מייל אחד: פירוק ו-Claude. מחזיר { mail, data } או null כשזו לא חשבונית
  async readOne(client, raw) {
    const mail = parseMail(raw);
    const { invoice } = await extractInvoice(client, mail);
    return invoice ? { mail, data: invoice } : null;
  }

  async aiLeft() {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const usage = (await this.storage.get('mail-ai')) || {};
    return usage.day !== day || usage.count < AI_PER_DAY;
  }

  // ניתוק כל התיבות (במחיקת כל הנתונים)
  async clear() {
    await this.storage.delete(['mail-accounts', 'mail-seen', 'mail-state']);
  }

  // ריצה על כל התיבות. client = לקוח Claude. מחזיר more=true כשנשאר עוד מה לקרוא
  async run(client) {
    const state = await this.state();
    // ריצה תקועה (יותר מ-20 דקות) לא חוסמת
    if (state.running && this.now() - state.startedAt < 20 * 60 * 1000) return state;
    const started = this.now();
    await this.storage.put('mail-state', { ...state, running: true, startedAt: started });
    const seen = new Set((await this.storage.get('mail-seen')) || []);
    let checked = 0;
    let found = 0;
    let more = false;
    const errors = [];
    const list = await this.accounts();
    // שמירה תוך כדי, כדי שריצה שנעצרה באמצע לא תאבד את מה שכבר נעשה
    const persist = async () => {
      const current = await this.accounts();
      await this.storage.put('mail-accounts', current.map((a) => {
        const x = list.find((y) => y.id === a.id);
        return x ? { ...a, lastRun: x.lastRun, lastError: x.lastError, found: x.found, firstDone: x.firstDone } : a;
      }));
      await this.storage.put('mail-seen', [...seen].slice(-SEEN_KEEP));
    };
    for (const account of list) {
      if (this.now() - started > RUN_MS) {
        more = true;
        break;
      }
      let imap;
      try {
        const password = await open(this.env.MAIL_KEY, account.box);
        imap = await this.withTimeout(Imap.open(await this.connect()), 20000, 'connect');
        await this.withTimeout(imap.login(account.email, password), 20000, 'login');
        await imap.selectAll();
        const uids = (await imap.searchGmail(QUERY(account.firstDone ? NEXT_DAYS : FIRST_DAYS))).sort((a, b) => b - a);
        const todo = uids.filter((u) => !seen.has(`${account.id}:${u}`)).slice(0, PER_RUN);
        let stopped = false;
        for (const uid of todo) {
          if (this.now() - started > RUN_MS) {
            stopped = true;
            break;
          }
          // מכסת ה-AI להיום נגמרה – ממשיכים מחר מאותו מקום
          if (!(await this.takeAi())) {
            stopped = true;
            break;
          }
          const raw = await this.withTimeout(imap.fetch(uid), 60000, 'fetch');
          const invoice = raw && raw.length <= MAX_MAIL_BYTES ? await this.readOne(client, raw) : null;
          // נקרא (חשבונית או לא) – לא קוראים אותו שוב; נשמר מיד
          seen.add(`${account.id}:${uid}`);
          checked += 1;
          if (!invoice) {
            await persist();
            continue;
          }
          const { mail } = invoice;
          found += 1;
          account.found = (account.found || 0) + 1;
          await this.putRecords([{
            id: `inv:${hash(mail.messageId || `${account.id}:${uid}`)}`,
            t: 'invoice',
            ...invoice.data,
            mailbox: account.email,
            from: (mail.from.match(/<([^>]+)>/)?.[1] || mail.from).slice(0, 80),
            subject: mail.subject.slice(0, 150),
            received: Number.isFinite(Date.parse(mail.date)) ? new Date(mail.date).toISOString().slice(0, 10) : '',
            pdf: mail.pdfs.length > 0,
          }]);
          await persist();
        }
        // נשארו מיילים (עוד מהיסטוריה, או שהריצה נעצרה) – ממשיכים בריצה הבאה
        const backlog = stopped || uids.filter((u) => !seen.has(`${account.id}:${u}`)).length > 0;
        if (backlog && (await this.aiLeft())) more = true;
        Object.assign(account, { lastRun: this.now(), lastError: '', firstDone: account.firstDone || !backlog });
      } catch (e) {
        console.error('mail run failed', account.id, String(e?.message || e).slice(0, 120));
        account.lastError = mailError(e);
        account.lastRun = this.now();
        errors.push(account.email);
      } finally {
        if (imap) await imap.logout();
      }
    }
    await persist();
    const done = { running: false, startedAt: started, lastRun: this.now(), checked, found, errors, more };
    await this.storage.put('mail-state', done);
    return done;
  }

  // הריצה הבאה: כל יום ב-05:30 שעון ישראל (בערך – 03:30 UTC)
  nextDaily() {
    const d = new Date(this.now());
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 30);
    return next > this.now() ? next : next + DAY;
  }
}
