// הצוות: Durable Object אחד ("main") – כל הבוטים, השיחות והזיכרון.
//
// אחסון (key-value של Durable Object):
//   owner          -> { id, name }  הבעלים (נקבע ב-/start <קוד> בצ'אט פרטי עם אחד הבוטים)
//   bots           -> { <agent>: { id, username } }  (נשמר בהקמה, ראו worker.js /setup)
//   seen           -> מזהי הודעות אחרונות (כל הבוטים בקבוצה מקבלים אותה הודעה – מטפלים פעם אחת)
//   q              -> תור עבודה [{ id, chat, thread, via, target, photo, turns, attempts }]
//   h:<chat>:<thr> -> השיחה בנושא (הודעות אחרונות) [{ who: 'owner'|<agent>, text, photo?, handoff?, at }]
//   notes          -> מה הצוות זוכר (רשימת משפטים)
//   cost:<YYYY-MM> -> { usd, days: { <DD>: usd }, agents: { <agent>: usd } }
// ועוד מה ששייך לאפליקציה (שיחות, קבצים, סיסמה, הגדרות) – ראו app.js.
//
// שני ערוצים לאותו צוות ולאותו זיכרון: Telegram (chan: 'tg') והאפליקציה (chan: 'app').
// הודעה חדשה רק נכנסת לתור; Durable Object alarm מריץ את הבוטים ברקע (תשובה יכולה לקחת דקה-שתיים).
// ב-Telegram התשובה נשלחת לקבוצה; באפליקציה היא פשוט נשמרת בשיחה, והאפליקציה מרעננת.
import Anthropic from '@anthropic-ai/sdk';
import { AGENTS, AGENT_KEYS, MODELS, TG_KEYS, aiMessage, appInfo, label, pickAgent, priceOf, runAgent, temporary } from './agents.js';
import { APP_PREFIX, addFile, checkFileUrl, getSettings, handleApp } from './app.js';
import { addSkill, learnFrom, listItems, read as maagarRead, search as maagarSearch, skillsOf } from './maagar.js';
import { genDone, genFail, genReady, genStart, proposeClip, runGenJob } from './gen.js';
import { renderDone, renderFail, renderInput, renderJob, startRender } from './render.js';
import { botIdOf, downloadImage, send, tokenOf, typing } from './telegram.js';

const MAX_HISTORY = 40;
const MAX_ENTRY = 4000;
// באפליקציה השיחה השמורה היא גם מה שמוצג, ולכן נשמר יותר (עד גבול הגודל של ערך אחד באחסון)
const MAX_HISTORY_APP = 120;
const MAX_ENTRY_APP = 12_000;
const MAX_HISTORY_BYTES = 1_200_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TURNS = 4;
const MAX_NOTES = 60;
const MAX_SEEN = 500;
const MAX_ATTEMPTS = 3;
const ALARM_BUDGET_MS = 10 * 60 * 1000;
const ILS = 3.7;

const ok = () => new Response('ok');
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
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
    // האפליקציה, ומה ש-worker.js צריך בשביל קבצים ועריכת וידאו
    if (pathname.startsWith('/app/') || pathname.startsWith('/internal/')) {
      try {
        const origin = request.headers.get('x-origin') || '';
        const data = pathname.startsWith('/app/')
          ? await handleApp(this, pathname, body || {}, request.headers, origin)
          : await this.internal(pathname, body || {});
        return json(200, data);
      } catch (e) {
        if (!e.status) console.error(pathname, e);
        return json(e.status || 500, { error: e.status ? e.message : 'תקלה בשרת' });
      }
    }
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

  // נקרא רק מ-worker.js (שכבר בדק מי מבקש)
  async internal(pathname, body) {
    const { storage } = this;
    switch (pathname) {
      case '/internal/file-add':
        return addFile(storage, body);
      case '/internal/file-check': {
        const f = await checkFileUrl(storage, body.id, body.e, body.s);
        if (!f) throw Object.assign(new Error('forbidden'), { status: 403 });
        return { type: f.type, name: f.name };
      }
      case '/internal/render-job':
        return renderJob(storage, body.id);
      case '/internal/render-input':
        return renderInput(storage, body.id, body.n);
      case '/internal/render-done':
        return renderDone(storage, body.id, body.file || {});
      case '/internal/render-fail':
        return renderFail(storage, body.id);
      // יצירת סרטון: gen-start מגיע למופע של העבודה, gen-done / gen-fail חוזרים ממנו למופע הראשי
      case '/internal/gen-start':
        return genStart(storage, body);
      case '/internal/gen-done':
        return genDone(this, body.id, body.file || {});
      case '/internal/gen-fail':
        return genFail(storage, body.id, body.error);
      default:
        throw Object.assign(new Error('not found'), { status: 404 });
    }
  }

  // ---------- התור והשיחות (משותף לשני הערוצים) ----------
  jobKey(job) {
    return job.key || histKey(job.chat, job.thread);
  }

  async enqueue(job) {
    const q = (await this.storage.get('q')) || [];
    q.push(job);
    await this.storage.put('q', q);
    await this.storage.setAlarm(Date.now());
  }

  // "עצור": מוציא מהתור את העבודות של השיחה. תור שכבר רץ מול Claude מסתיים, אבל התשובה שלו לא נשמרת
  async dropJobs(key) {
    const q = (await this.storage.get('q')) || [];
    await this.storage.put('q', q.filter((j) => this.jobKey(j) !== key));
    await this.setBusy(key, null);
  }

  async setBusy(key, agent) {
    const busy = (await this.storage.get('busy')) || {};
    if (agent) busy[key] = { agent, at: Date.now() };
    else delete busy[key];
    await this.storage.put('busy', busy);
  }

  async pushHistory(key, entry) {
    const app = key.startsWith(APP_PREFIX);
    let history = (await this.storage.get(key)) || [];
    history.push({ ...entry, text: String(entry.text || '').slice(0, app ? MAX_ENTRY_APP : MAX_ENTRY) });
    history = history.slice(-(app ? MAX_HISTORY_APP : MAX_HISTORY));
    while (history.length > 10 && JSON.stringify(history).length > MAX_HISTORY_BYTES) history.shift();
    await this.storage.put(key, history);
  }

  // הודעת מערכת (עצירה, תקלה): ב-Telegram נשלחת, באפליקציה נשמרת בשיחה
  async notice(job, text, via = job.via) {
    if (job.chan === 'app') return this.pushHistory(job.key, { who: 'system', text, at: Date.now() });
    return send(this.env, tokenOf(this.env, via), job, text);
  }

  // מי זמין בערוץ: ב-Telegram רק בוטים שיש להם טוקן
  teamOf(job) {
    if (job.chan === 'app') return AGENT_KEYS;
    const withToken = TG_KEYS.filter((k) => tokenOf(this.env, k));
    return withToken.length ? withToken : TG_KEYS;
  }

  // התמונות מההודעה האחרונה של הבעלים (וגם פריים מכל סרטון) – כדי שהבוט יראה אותן
  async appImages(history) {
    const last = [...history].reverse().find((h) => h.who === 'owner');
    const ids = (last?.files || []).map((f) => (f.kind === 'image' ? f.id : f.poster)).filter(Boolean).slice(0, MAX_IMAGES);
    const out = [];
    for (const id of ids) {
      const rec = await this.storage.get(`f:${id}`);
      const obj = rec && this.env.FILES ? await this.env.FILES.get(`files/${id}`).catch(() => null) : null;
      if (!obj || !/^image\/(jpeg|png|webp|gif)$/.test(rec.type)) continue;
      const bytes = new Uint8Array(await obj.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) continue;
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out.push({ type: 'image', source: { type: 'base64', media_type: rec.type, data: btoa(bin) } });
    }
    return out;
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
    await this.pushHistory(key, { who: 'owner', text, ...(photo ? { photo: true } : {}), at: Date.now() });

    const target = isPrivate ? agent : await this.addressed(m);
    await this.enqueue({ id: newId(), chan: 'tg', key, chat, thread, private: isPrivate, via: agent, target, photo, turns: 0, attempts: 0 });
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
    // במופע של יצירת סרטון ("gen:<id>") זו כל העבודה
    if (await runGenJob(this)) return;
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
        await this.notice(job, `⚠️ ${aiMessage(e)}`).catch(() => {});
      }
      await this.setBusy(this.jobKey(job), null);
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

  // העבודה עדיין בתור? (באפליקציה אפשר לעצור באמצע)
  async alive(job) {
    return ((await this.storage.get('q')) || []).some((j) => j.id === job.id);
  }

  async work(job) {
    const client = this.client();
    const app = job.chan === 'app';
    const key = this.jobKey(job);
    const team = this.teamOf(job);
    const owner = await this.storage.get('owner');
    const { models } = await getSettings(this.storage);
    let agent = team.includes(job.target) ? job.target : null;
    if (!agent) {
      if (!app) await typing(this.env, tokenOf(this.env, job.via), job);
      const history = (await this.storage.get(key)) || [];
      const r = await pickAgent(client, history, team).catch(() => ({ agent: team[0], usage: [] }));
      await this.addCost(r.usage, 'router');
      agent = r.agent;
      job = { ...job, target: agent };
      await this.saveJob(job);
    }
    let image = null;
    if (!app && job.photo) image = await downloadImage(this.env, tokenOf(this.env, job.via), job.photo).catch(() => null);

    const renders = [];
    const gens = [];
    const maagar = Boolean(this.env.MAAGAR);
    let cache = null;
    const items = () => (cache ||= listItems(this.env));
    const tools = {
      app_info: ({ app: name }) => appInfo(name),
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
      edit_video: (input) => startRender(this, job, input, renders),
      make_video: (input) => proposeClip(this, job, input, gens),
      // מאגר AI: הרשימה נטענת פעם אחת לכל עבודה
      maagar_search: async ({ query, area }) => maagarSearch(await items(), query, area),
      maagar_read: async ({ id }) => maagarRead(await items(), id),
      maagar_learn: async ({ id }) => {
        const learnId = await learnFrom(this.env, id);
        cache = null;
        return `Started. The repository is studying it in the background (1-2 minutes); the result will be item ${learnId} – search or read it again later.`;
      },
      teach: async (input) => {
        const r = addSkill((await this.storage.get('skills')) || [], input, AGENT_KEYS);
        if (r.error) return r.error;
        await this.storage.put('skills', r.skills);
        return `Saved skill "${r.saved.name}" for ${r.saved.agents.join(', ')}.`;
      },
      unteach: async ({ name }) => {
        const skills = (await this.storage.get('skills')) || [];
        const left = skills.filter((s) => s.name !== String(name || '').trim());
        if (left.length === skills.length) return `No such skill. Existing: ${skills.map((s) => s.name).join(', ') || '-'}`;
        await this.storage.put('skills', left);
        return 'Removed.';
      },
      use_skill: async ({ name }) => {
        const skill = ((await this.storage.get('skills')) || []).find((s) => s.name === name);
        return skill ? `# ${skill.title}\n\n${skill.body}` : 'No such skill.';
      },
    };

    while (agent && job.turns < MAX_TURNS) {
      const { token, prefix } = app ? {} : this.speaker(job, agent);
      if (app) await this.setBusy(key, agent);
      else await typing(this.env, token, job);
      const history = (await this.storage.get(key)) || [];
      const notes = (await this.storage.get('notes')) || [];
      const images = app ? await this.appImages(history) : image ? [image] : [];
      const r = await runAgent(client, {
        agent, notes, history: history.slice(-30), owner: owner?.name, images,
        model: MODELS[models[agent]], team, channel: app ? 'app' : 'tg',
        maagar, skills: skillsOf((await this.storage.get('skills')) || [], agent),
        gen: app && genReady(this.env),
      }, tools);
      await this.addCost(r.usage, agent);
      // נעצר באמצע (מהאפליקציה)? התשובה לא נשמרת
      if (!(await this.alive(job))) return;

      const next = r.handoff?.to || null;
      await this.pushHistory(key, {
        who: agent, text: r.text || '',
        ...(r.handoff ? { handoff: r.handoff } : {}),
        ...(renders.length ? { renders: renders.splice(0) } : {}),
        ...(gens.length ? { gens: gens.splice(0) } : {}),
        at: Date.now(),
      });
      job = { ...job, target: next, turns: job.turns + 1, attempts: 0 };
      await this.saveJob(job);

      if (!app) {
        const handoffLine = r.handoff ? `\n\n↪️ ${label(r.handoff.to)}: ${r.handoff.request}` : '';
        const out = `${r.text || ''}${handoffLine}`.trim();
        if (out) await send(this.env, token, job, `${prefix}${out}`);
      }
      agent = next;
    }
    if (agent) {
      await this.notice(job, '⏸️ עצרנו כאן כדי לא לרוץ סתם. לכתוב "תמשיכו" כדי להמשיך.', job.private ? job.via : team[0]);
    }
  }

  // who = הבוט שעבד (או 'router' – ההחלטה מי עונה), כדי לראות באפליקציה כמה כל אחד עולה
  async addCost(usage = [], who = '') {
    const usd = usage.reduce((s, u) => s + priceOf(u), 0);
    if (!usd) return;
    const date = israelDate();
    const key = `cost:${date.slice(0, 7)}`;
    const c = (await this.storage.get(key)) || { usd: 0, days: {} };
    c.usd += usd;
    c.days[date.slice(8)] = (c.days[date.slice(8)] || 0) + usd;
    if (who) c.agents = { ...(c.agents || {}), [who]: ((c.agents || {})[who] || 0) + usd };
    await this.storage.put(key, c);
  }
}
