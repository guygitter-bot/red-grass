// הצוות: Durable Object אחד ("main") – כל הבוטים, השיחות והזיכרון.
//
// אחסון (key-value של Durable Object):
//   owner          -> { id, name }  הבעלים (נקבע ב-/start <קוד> בצ'אט פרטי עם אחד הבוטים)
//   bots           -> { <agent>: { id, username } }  (נשמר בהקמה, ראו worker.js /setup)
//   seen           -> מזהי הודעות אחרונות (כל הבוטים בקבוצה מקבלים אותה הודעה – מטפלים פעם אחת)
//   q              -> תור עבודה [{ id, chat, thread, via, target, photo, turns, attempts }]
//   h:<chat>:<thr> -> השיחה בנושא (הודעות אחרונות) [{ who: 'owner'|<agent>, text, photo?, handoff?, at }]
//   notes          -> מה הצוות זוכר (רשימת משפטים)
//   cost:<YYYY-MM> -> { usd, days: { <DD>: usd } }
//
// עדכון מ-Telegram רק נכנס לתור; Durable Object alarm מריץ את הבוטים ברקע (תשובה יכולה לקחת דקה-שתיים).
import Anthropic from '@anthropic-ai/sdk';
import { AGENTS, AGENT_KEYS, aiMessage, appInfo, label, pickAgent, priceOf, runAgent, temporary } from './agents.js';
import { botIdOf, downloadImage, send, tokenOf, typing } from './telegram.js';

const MAX_HISTORY = 40;
const MAX_ENTRY = 4000;
const MAX_TURNS = 4;
const MAX_NOTES = 60;
const MAX_SEEN = 500;
const MAX_ATTEMPTS = 3;
const ALARM_BUDGET_MS = 10 * 60 * 1000;
const ILS = 3.7;

const ok = () => new Response('ok');
const histKey = (chat, thread) => `h:${chat}:${thread || 0}`;
const newId = () => crypto.randomUUID().slice(0, 12);
const israelDate = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(t);
const money = (usd) => `$${usd.toFixed(2)} (≈ ₪${(usd * ILS).toFixed(2)})`;

export function welcome(name) {
  return `שלום ${name}! 👋 זה הצוות שלך:\n\n` +
    AGENT_KEYS.map((k) => `${label(k)} – ${AGENTS[k].short}`).join('\n') +
    `\n\n**איך עובדים**\n` +
    `• הכי נוח בקבוצה עם נושאים: כותבים מה צריך, הצוות מחליט מי עונה, והבוטים מעבירים עבודה ביניהם.\n` +
    `• לפנות לבוט מסוים: לענות (Reply) על הודעה שלו, או לכתוב @ ואת השם שלו.\n` +
    `• אפשר לשלוח גם תמונה עם הסבר.\n\n` +
    `/costs – כמה זה עלה\n/memory – מה הצוות זוכר\n/reset – להתחיל את הנושא הזה מחדש`;
}

export class Team {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  client() {
    return this.env.AI_CLIENT || new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    if (pathname === '/update') {
      try {
        await this.update(body.agent, body.update || {});
      } catch (e) {
        console.error('update', e);
      }
      return ok();
    }
    if (pathname === '/bots') {
      await this.storage.put('bots', body.bots || {});
      return ok();
    }
    return new Response('not found', { status: 404 });
  }

  // ---------- הודעה חדשה מ-Telegram ----------
  async update(agent, update) {
    const m = update.message;
    if (!m || !m.from || m.from.is_bot || !AGENT_KEYS.includes(agent)) return;
    const isPrivate = m.chat?.type === 'private';
    const chat = m.chat.id;
    const thread = !isPrivate && m.is_topic_message ? m.message_thread_id : null;
    const where = { chat, thread };
    const token = tokenOf(this.env, agent);

    // כל הבוטים בקבוצה מקבלים את אותה הודעה – רק הראשון מטפל
    const seenKey = `${isPrivate ? agent : 'g'}:${chat}:${m.message_id}`;
    const seen = (await this.storage.get('seen')) || [];
    if (seen.includes(seenKey)) return;
    seen.push(seenKey);
    await this.storage.put('seen', seen.slice(-MAX_SEEN));

    const text = String(m.text ?? m.caption ?? '').trim();
    const cmd = text.match(/^\/([a-z_]+)(?:@\w+)?\s*([\s\S]*)$/i);
    let owner = await this.storage.get('owner');

    if (cmd && cmd[1].toLowerCase() === 'start') {
      const code = String(this.env.TEAM_OWNER_CODE || '');
      if (!owner && isPrivate && code && cmd[2].trim() === code) {
        owner = { id: m.from.id, name: m.from.first_name || 'שלום' };
        await this.storage.put('owner', owner);
      }
      if (owner?.id === m.from.id) return send(this.env, token, where, welcome(owner.name));
      if (isPrivate) return send(this.env, token, where, 'זה בוט פרטי 🙂');
      return;
    }
    // רק הבעלים מדבר עם הצוות (על חשבונו)
    if (!owner || m.from.id !== owner.id) {
      if (isPrivate) await send(this.env, token, where, 'זה בוט פרטי 🙂');
      return;
    }

    if (cmd) return this.command(cmd[1].toLowerCase(), token, where);

    const photo = m.photo?.length
      ? m.photo[m.photo.length - 1].file_id
      : m.document && /^image\//.test(m.document.mime_type || '') ? m.document.file_id : null;
    if (!text && !photo) {
      if (m.voice || m.audio || m.video_note) return send(this.env, token, where, 'עדיין לא שומעים הודעות קוליות – אפשר לכתוב 🙂');
      return;
    }

    const key = histKey(chat, thread);
    const history = (await this.storage.get(key)) || [];
    history.push({ who: 'owner', text: text.slice(0, MAX_ENTRY), ...(photo ? { photo: true } : {}), at: Date.now() });
    await this.storage.put(key, history.slice(-MAX_HISTORY));

    const target = isPrivate ? agent : await this.addressed(m);
    const q = (await this.storage.get('q')) || [];
    q.push({ id: newId(), chat, thread, private: isPrivate, via: agent, target, photo, turns: 0, attempts: 0 });
    await this.storage.put('q', q);
    await this.storage.setAlarm(Date.now());
  }

  // פנו לבוט מסוים? (תשובה להודעה שלו או @שם)
  async addressed(m) {
    const replyTo = m.reply_to_message?.from?.id;
    if (replyTo) {
      const byReply = AGENT_KEYS.find((k) => botIdOf(tokenOf(this.env, k)) === replyTo);
      if (byReply) return byReply;
    }
    const bots = (await this.storage.get('bots')) || {};
    const text = String(m.text ?? m.caption ?? '').toLowerCase();
    return AGENT_KEYS.find((k) => bots[k]?.username && text.includes(`@${bots[k].username.toLowerCase()}`)) || null;
  }

  async command(name, token, where) {
    if (name === 'costs') {
      const month = israelDate().slice(0, 7);
      const day = israelDate().slice(8);
      const c = (await this.storage.get(`cost:${month}`)) || { usd: 0, days: {} };
      return send(this.env, token, where, `💰 **עלות Claude**\nהיום: ${money(c.days[day] || 0)}\nהחודש: ${money(c.usd)}`);
    }
    if (name === 'memory') {
      const notes = (await this.storage.get('notes')) || [];
      return send(this.env, token, where, notes.length
        ? `🧠 **מה הצוות זוכר**\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nלמחוק משהו? פשוט לכתוב "תשכחו את מספר 3".`
        : 'הצוות עוד לא שמר כלום. אפשר לכתוב "תזכרו ש..."');
    }
    if (name === 'reset') {
      await this.storage.delete(histKey(where.chat, where.thread));
      return send(this.env, token, where, 'התחלנו את הנושא הזה מחדש 🧹 (מה שהצוות זוכר נשאר)');
    }
    const owner = await this.storage.get('owner');
    return send(this.env, token, where, welcome(owner?.name || ''));
  }

  // ---------- עבודה ברקע ----------
  async alarm() {
    const started = Date.now();
    while (Date.now() - started < ALARM_BUDGET_MS) {
      const q = (await this.storage.get('q')) || [];
      const job = q[0];
      if (!job) return;
      try {
        await this.work(job);
      } catch (e) {
        console.error('work', e);
        if (temporary(e) && job.attempts + 1 < MAX_ATTEMPTS) {
          await this.saveJob({ ...job, attempts: job.attempts + 1 });
          await this.storage.setAlarm(Date.now() + 30_000 * (job.attempts + 1));
          return;
        }
        const token = tokenOf(this.env, job.via);
        await send(this.env, token, job, `⚠️ ${aiMessage(e)}`).catch(() => {});
      }
      await this.storage.put('q', ((await this.storage.get('q')) || []).filter((j) => j.id !== job.id));
    }
    await this.storage.setAlarm(Date.now() + 1000);
  }

  async saveJob(job) {
    const q = (await this.storage.get('q')) || [];
    await this.storage.put('q', q.map((j) => (j.id === job.id ? job : j)));
  }

  // איך בוט מדבר: בקבוצה – בשם שלו; בצ'אט פרטי – דרך הבוט של הצ'אט, עם שם הבוט בראש ההודעה
  speaker(job, agent) {
    const via = job.private ? job.via : agent;
    return { token: tokenOf(this.env, via), prefix: via === agent ? '' : `${label(agent)}:\n` };
  }

  async work(job) {
    const client = this.client();
    const key = histKey(job.chat, job.thread);
    const owner = await this.storage.get('owner');
    let agent = job.target;
    if (!agent) {
      await typing(this.env, tokenOf(this.env, job.via), job);
      const history = (await this.storage.get(key)) || [];
      const r = await pickAgent(client, history).catch(() => ({ agent: AGENT_KEYS[0], usage: [] }));
      await this.addCost(r.usage);
      agent = r.agent;
      job = { ...job, target: agent };
      await this.saveJob(job);
    }
    let image = null;
    if (job.photo) image = await downloadImage(this.env, tokenOf(this.env, job.via), job.photo).catch(() => null);

    const tools = {
      app_info: ({ app }) => appInfo(app),
      remember: async ({ note }) => {
        const clean = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (!clean) return 'Empty note';
        const notes = (await this.storage.get('notes')) || [];
        notes.push(clean);
        await this.storage.put('notes', notes.slice(-MAX_NOTES));
        return 'Saved';
      },
      forget: async ({ number }) => {
        const notes = (await this.storage.get('notes')) || [];
        const i = Number(number) - 1;
        if (!(i >= 0 && i < notes.length)) return 'No such note';
        notes.splice(i, 1);
        await this.storage.put('notes', notes);
        return 'Deleted';
      },
    };

    while (agent && job.turns < MAX_TURNS) {
      const { token, prefix } = this.speaker(job, agent);
      await typing(this.env, token, job);
      const history = (await this.storage.get(key)) || [];
      const notes = (await this.storage.get('notes')) || [];
      const r = await runAgent(client, { agent, notes, history: history.slice(-30), owner: owner?.name, image }, tools);
      await this.addCost(r.usage);

      const next = r.handoff?.to || null;
      history.push({ who: agent, text: (r.text || '').slice(0, MAX_ENTRY), ...(r.handoff ? { handoff: r.handoff } : {}), at: Date.now() });
      await this.storage.put(key, history.slice(-MAX_HISTORY));
      job = { ...job, target: next, turns: job.turns + 1, attempts: 0 };
      await this.saveJob(job);

      const handoffLine = r.handoff ? `\n\n↪️ ${label(r.handoff.to)}: ${r.handoff.request}` : '';
      const out = `${r.text || ''}${handoffLine}`.trim();
      if (out) await send(this.env, token, job, `${prefix}${out}`);
      agent = next;
    }
    if (agent) {
      const { token } = this.speaker(job, AGENT_KEYS[0]);
      await send(this.env, token, job, '⏸️ עצרנו כאן כדי לא לרוץ סתם. לכתוב "תמשיכו" כדי להמשיך.');
    }
  }

  async addCost(usage = []) {
    const usd = usage.reduce((s, u) => s + priceOf(u), 0);
    if (!usd) return;
    const date = israelDate();
    const key = `cost:${date.slice(0, 7)}`;
    const c = (await this.storage.get(key)) || { usd: 0, days: {} };
    c.usd += usd;
    c.days[date.slice(8)] = (c.days[date.slice(8)] || 0) + usd;
    await this.storage.put(key, c);
  }
}
