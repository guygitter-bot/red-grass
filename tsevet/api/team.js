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
import { AGENTS, AGENT_KEYS, MODELS, SELF_LEARNERS, SKILL_SEEKERS, STOP, TG_KEYS, aiMessage, appInfo, label, pickAgent, priceOf, runAgent, temporary } from './agents.js';
import { APP_PREFIX, addFile, fileUrl as fileUrlOf, checkFileUrl, getSettings, handleApp, newId as convIdNew } from './app.js';
import { IG_SKILLS } from './igskills.js';
import { CODE_WORD, DESIGN_PACK } from './designpack.js';
import { MOTION_NOTE } from './motion.js';
import { loadExpert, searchExperts } from './agency.js';
import { bursaReady, bursaTools } from './bursa.js';
import { appsOf, appsText, codeTools, devDone, devFail, devJob, devQuestion, devReady, proposeChange } from './dev.js';
import { readSkill as githubRead, searchSkills as githubSearch } from './github.js';
import { addSkill, learnFrom, listItems, pendingOf, read as maagarRead, search as maagarSearch, skillsOf } from './maagar.js';
import { genDone, genFail, genReady, genStart, proposeClip, runGenJob } from './gen.js';
import { CREATORS, FILE_MAKERS, imagesReady, makeFile, proposeImage } from './create.js';
import { proposeSite, siteDone, siteFail, siteInput, siteJob } from './sites.js';
import { finishMeta, proposePost, runSocial, socialAccounts } from './meta.js';
import { AUDIO_MAKERS, audioReady, audioVoices, proposeAudio, runAudio } from './audio.js';
import { importLink } from './links.js';
import { designSkills } from './design.js';
import { FIND_SKILLS } from './findskills.js';
import { DEFAULT_BUDGET, isDue, nextOf } from './schedule.js';
import { notifyOwner } from './notify.js';
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
const MAX_DOCS = 3;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_DOC_TEXT = 60_000;
// סקילים מובנים (נבנים מהמאגר בכל עלייה): בוט האינסטגרם מקבל את חבילת ig-*
// חבילות סקילים קבועות: האינסטגרם – ig-*; הקריאייטיב – ארגז כלי העיצוב (designpack.js)
const BUILTIN = { social: IG_SKILLS, creative: DESIGN_PACK };
const builtinSkills = (agent) => (BUILTIN[agent] || []).map((s) => ({ ...s, builtin: true }));
// מילת הקוד של הקריאייטיב: בוחר סקיל מתאים מארגז הכלים
const CODE_WORD_NOTE = `Code word "${CODE_WORD}": when the owner's message contains it, use your design toolbox. Pick the skill that fits the request – \
taste-skill (build a premium landing page / site), web-design-guidelines (review/audit a page), awesome-design (the look of a known brand), \
image-to-code (design as an image first, then build) – or two of them when it clearly helps (e.g. build, then review). \
Load it with use_skill, tell the owner in one line which one you chose and why, and follow it. Without the code word, use them only when clearly useful.`;
const MAX_TURNS = 4;
// משימה של המנהל: תוכנית ראשונה + סבב תיקון אחד, ותקרת תורות כדי לא לרוץ סתם
const MAX_PLAN_ROUNDS = 2;
const MAX_PLAN_TURNS = 16;
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
        // קובץ שהצוות יצר עם תמונות בתוכו: קישורים חתומים ועדכניים לתמונות
        const links = {};
        for (const id of f.links || []) links[id] = await fileUrlOf(storage, body.origin, id);
        return { type: f.type, name: f.name, kind: f.kind, ...(f.links?.length ? { links } : {}) };
      }
      // פרסום אתר ל-Pages (publish_page, tsevet-site.yml)
      // חיבור לפייסבוק ואינסטגרם: Meta חוזרת עם קוד (meta.js)
      case '/internal/meta-finish':
        return finishMeta(this, body);
      case '/internal/site-job':
        return siteJob(storage, body.id);
      case '/internal/site-input':
        return siteInput(storage, body.id, body.f);
      case '/internal/site-done':
        return siteDone(storage, body.id, body.url);
      case '/internal/site-fail':
        return siteFail(storage, body.id, body.reason);
      case '/internal/render-job':
        return renderJob(storage, body.id);
      case '/internal/render-input':
        return renderInput(storage, body.id, body.n);
      case '/internal/render-done':
        return renderDone(this, body.id, body.file || {}, body.usd, body.html === true);
      case '/internal/render-fail':
        return renderFail(this, body.id, body.usd);
      // יצירת סרטון: gen-start מגיע למופע של העבודה, gen-done / gen-fail חוזרים ממנו למופע הראשי
      case '/internal/gen-start':
        return genStart(storage, body);
      // המתכנת: ה-workflow (tsevet-dev.yml) קורא את הבקשה ומדווח
      case '/internal/dev-job':
        return devJob(storage, body.id);
      case '/internal/dev-done':
        return devDone(this, body.id, body);
      case '/internal/dev-question':
        return devQuestion(this, body.id, body);
      case '/internal/dev-fail':
        return devFail(this, body.id, body);
      case '/internal/gen-done':
        return genDone(this, body.id, body.file || {});
      case '/internal/gen-fail':
        return genFail(storage, body.id, body.error);
      default:
        throw Object.assign(new Error('not found'), { status: 404 });
    }
  }

  // ---------- משימות קבועות (schedule.js) ----------
  // מה שהגיע זמנו נכנס לתור, כאילו הבעלים כתב אותו בשיחה של המשימה
  async runSchedules(now = Date.now()) {
    const schedules = (await this.storage.get('schedules')) || [];
    const due = schedules.filter((s) => isDue(s, now));
    for (const s of due) await this.startSchedule(s, now);
  }

  async startSchedule(s, now = Date.now()) {
    const schedules = (await this.storage.get('schedules')) || [];
    const item = schedules.find((x) => x.id === s.id);
    if (!item) return null;
    // שיחה משלה לכל משימה קבועה (נוצרת בפעם הראשונה, או מחדש אם נמחקה)
    const convs = (await this.storage.get('convs')) || [];
    let conv = convs.find((c) => c.id === item.conv);
    if (!conv) {
      conv = { id: convIdNew(), title: `⏰ ${item.title}`, at: now };
      convs.unshift(conv);
      item.conv = conv.id;
    }
    conv.at = now;
    await this.storage.put('convs', convs);
    item.lastRun = now;
    await this.storage.put('schedules', schedules);
    const key = `${APP_PREFIX}${conv.id}`;
    await this.pushHistory(key, { who: 'owner', text: item.text, scheduled: item.title, at: now });
    await this.enqueue({ id: newId(), chan: 'app', key, target: item.to, turns: 0, attempts: 0, budget: item.budget || DEFAULT_BUDGET, notify: item.title });
    return conv.id;
  }

  // ההשכמה הבאה: המשימה הקבועה הקרובה (אם אין עבודה בתור)
  async armSchedules() {
    const times = [nextOf((await this.storage.get('schedules')) || [], Date.now()), await this.storage.get('social:next')].filter(Boolean);
    if (!times.length) return;
    const next = Math.min(...times);
    const current = await this.storage.getAlarm();
    if (!current || current > next || current < Date.now()) await this.storage.setAlarm(next);
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

  // מי זמין בערוץ: בחדר – רק מי שבחדר; באפליקציה – כולם; ב-Telegram רק בוטים שיש להם טוקן
  async teamOf(job) {
    if (job.chan === 'app') {
      const key = this.jobKey(job);
      const room = ((await this.storage.get('convs')) || []).find((c) => `${APP_PREFIX}${c.id}` === key)?.members;
      return room?.length ? room : AGENT_KEYS;
    }
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
    // מסמכים (PDF / טקסט) מההודעה האחרונה – הבוט קורא אותם מיד
    for (const f of (last?.files || []).filter((x) => x.kind === 'doc').slice(0, MAX_DOCS)) {
      const block = await this.docBlock(f.id);
      if (block) out.push(block);
    }
    return out;
  }

  // מסמך שהועלה -> בלוק לבוט: PDF כמסמך (Claude קורא גם סרוק), טקסט כטקסט. from = מאיפה להמשיך בטקסט ארוך
  async docBlock(id, from = 0) {
    const rec = await this.storage.get(`f:${String(id || '')}`);
    if (rec?.kind !== 'doc' || !this.env.FILES) return null;
    const obj = await this.env.FILES.get(`files/${rec.id}`).catch(() => null);
    if (!obj) return null;
    if (rec.type === 'application/pdf') {
      const bytes = new Uint8Array(await obj.arrayBuffer());
      if (bytes.length > MAX_PDF_BYTES) return { type: 'text', text: `[document ${rec.id} "${rec.name}" is too large to read (over 20MB)]` };
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: btoa(bin) }, title: rec.name || 'document.pdf' };
    }
    const text = await obj.text();
    const start = Math.max(Number(from) || 0, 0);
    const part = text.slice(start, start + MAX_DOC_TEXT);
    const more = start + MAX_DOC_TEXT < text.length ? `\n…[more – read_file with from: ${start + MAX_DOC_TEXT}]` : '';
    return { type: 'text', text: `[document ${rec.id} "${rec.name}" – content${start ? ` from character ${start}` : ''}]\n${part}${more}` };
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
    await this.runSchedules();
    // פוסטים מאושרים: מה שהגיע זמנו מתפרסם, וריל באינסטגרם נבדק עד שמוכן (meta.js)
    // קריינות / מוזיקה מ-ElevenLabs שאושרו (audio.js)
    await runAudio(this).catch((e) => console.error('audio', e));
    await this.storage.put('social:next', await runSocial(this).catch((e) => {
      console.error('social', e);
      return Date.now() + 60_000;
    }));
    const started = Date.now();
    while (Date.now() - started < ALARM_BUDGET_MS) {
      const q = (await this.storage.get('q')) || [];
      const job = q[0];
      if (!job) return this.armSchedules();
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
      // התראה לטלפון כשמשימה הסתיימה (משימה קבועה – תמיד; רגילה – אם ביקשו בהגדרות)
      if (job.chan === 'app') await notifyOwner(this, job).catch((e) => console.error('notify', e));
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
    const team = await this.teamOf(job);
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
    const devs = [];
    const made = [];
    const imgs = [];
    const sites = [];
    const posts = [];
    const audios = [];
    const maagar = Boolean(this.env.MAAGAR);
    // סקילים מ-GitHub: מה שנמצא בחיפוש (רק אותו אפשר לקרוא), ומה שנקרא אחרון (מקור הסקיל שיישמר)
    const githubFound = new Map();
    let githubLast = null;
    const proposed = [];
    let cache = null;
    const items = () => (cache ||= listItems(this.env));
    // הבוט שבתור עכשיו (כלים כמו teach בודקים מי קורא להם)
    let current = agent;
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
      // קריאת מסמך מהשיחה (PDF / Word / Excel / טקסט)
      // קישור מגוגל / קישור ישיר -> קובץ בשיחה (links.js)
      import_link: (input) => importLink(this, input, made),
      read_file: async ({ id, from }) => {
        const block = await this.docBlock(id, from);
        return block ? [block] : 'No such document. Use an id that appears as [file <id>: document ...].';
      },
      // אפליקציית בורסאי (רק לבוט 📈 בורסאי; הכלים מוצעים לו רק כשיש חיבור)
      ...(bursaReady(this.env) ? bursaTools(this.env) : {}),
      // המתכנת: קריאת הקוד במאגר, והצעת שינוי (שרץ רק אחרי אישור)
      ...(devReady(this.env) ? codeTools(this) : {}),
      code_change: (input) => proposeChange(this, job, input, devs),
      make_video: (input) => proposeClip(this, job, input, gens),
      // קבצים ותמונות (רק קריאייטיב והמתכנת; התמונה רק באישור – create.js)
      make_file: (input) => makeFile(this, input, made),
      make_image: (input) => (CREATORS.includes(job.target) ? proposeImage(this, job, input, imgs) : 'Not available for you.'),
      make_audio: (input) => (AUDIO_MAKERS.includes(job.target) ? proposeAudio(this, job, input, audios) : 'Not available for you.'),
      audio_voices: () => (AUDIO_MAKERS.includes(job.target) ? audioVoices(this) : 'Not available for you.'),
      social_accounts: () => (job.target === 'social' ? socialAccounts(this) : 'Not available for you.'),
      propose_post: (input) => (job.target === 'social' ? proposePost(this, job, input, posts) : 'Not available for you.'),
      publish_page: (input) => (CREATORS.includes(job.target) ? proposeSite(this, job, input, sites) : 'Not available for you.'),
      // מאגר AI: הרשימה נטענת פעם אחת לכל עבודה
      maagar_search: async ({ query, area }) => maagarSearch(await items(), query, area),
      maagar_read: async ({ id }) => maagarRead(await items(), id),
      github_skills_search: async ({ query }) => githubSearch(this.env, query, githubFound),
      github_skill_read: async ({ ref }) => {
        const out = await githubRead(this.env, ref, githubFound);
        if (githubFound.has(ref)) githubLast = { ref, ...githubFound.get(ref).trust };
        return out;
      },
      maagar_learn: async ({ id }) => {
        const learnId = await learnFrom(this.env, id);
        cache = null;
        return `Started. The repository is studying it in the background (1-2 minutes); the result will be item ${learnId} – search or read it again later.`;
      },
      // הספרן מלמד את כולם; בוט שלומד לעצמו – רק את עצמו. כל סקיל חדש מחכה לאישור הבעלים, והתור נגמר (STOP)
      teach: async (input) => {
        const own = current !== 'librarian';
        // אחרי קריאה מ-GitHub בתור הזה – המקור נשמר עם ההצעה (מוצג לבעלים)
        const origin = githubLast ? { repo: githubLast.repo, url: githubLast.url, stars: githubLast.stars, official: githubLast.official, updated: githubLast.updated, license: githubLast.license } : null;
        const proposedIn = job.chan === 'app' ? { key: this.jobKey(job), agent: current } : null;
        const r = addSkill((await this.storage.get('skills')) || [], { ...(own ? { ...input, agents: [current] } : input), origin, proposedIn }, AGENT_KEYS);
        if (!r.error && own) {
          const before = ((await this.storage.get('skills')) || []).find((s) => s.name === r.saved.name);
          if (before && String(before.agents) !== String([current])) return 'A team skill with this name already exists. Choose another name.';
        }
        if (r.error) return r.error;
        await this.storage.put('skills', r.skills);
        proposed.push(r.saved.name);
        const from = origin ? ` It comes from GitHub (${origin.repo}, ⭐ ${origin.stars}).` : '';
        return `${STOP} Saved "${r.saved.name}" as a proposal${r.saved.update ? ' (an update – the current version keeps working until then)' : ''}.${from} Only the owner can approve it, with the "לאשר" button above the message box (or on the card under your message); writing "מאשר" in the chat does not approve it. Your turn ends here – after approval you'll continue automatically.`;
      },
      unteach: async ({ name }) => {
        const skills = (await this.storage.get('skills')) || [];
        const mine = (s) => current === 'librarian' || String(s.agents) === String([current]);
        const left = skills.filter((s) => s.name !== String(name || '').trim() || !mine(s));
        if (left.length === skills.length) return `No such skill. Existing: ${skills.map((s) => s.name).join(', ') || '-'}`;
        await this.storage.put('skills', left);
        return 'Removed.';
      },
      // הסוכנות: ספריית המומחים (agency.js)
      experts_search: async ({ query, division }) => searchExperts(query, division),
      expert_load: async ({ name }) => loadExpert(this.env, name),
      use_skill: async ({ name }) => {
        const skill = ((await this.storage.get('skills')) || []).find((s) => s.name === name && !s.pending)
          || [...designSkills(current), FIND_SKILLS, ...builtinSkills(current)].find((s) => s.name === name);
        return skill ? `# ${skill.title}\n\n${skill.body}` : 'No such skill.';
      },
    };

    // תוכנית של המנהל: job.plan = השלבים שנשארו, job.step / job.steps = איפה אנחנו, job.rounds = כמה תוכניות היו
    const limit = () => (job.rounds ? MAX_PLAN_TURNS : MAX_TURNS);
    // job.budget = תקרת הוצאה למשימה (משימות קבועות); job.spent = כמה עלתה עד עכשיו
    while (agent && job.turns < limit() && !(job.budget && job.spent >= job.budget)) {
      current = agent;
      const { token, prefix } = app ? {} : this.speaker(job, agent);
      if (app) await this.setBusy(key, agent);
      else await typing(this.env, token, job);
      const history = (await this.storage.get(key)) || [];
      const notes = (await this.storage.get('notes')) || [];
      const images = app ? await this.appImages(history) : image ? [image] : [];
      const allSkills = (await this.storage.get('skills')) || [];
      const inPlan = Boolean(job.plan?.length) && agent === job.plan[0].to;
      const review = !inPlan && agent === 'manager' && job.rounds > 0;
      const resume = Boolean(job.resume) && job.turns === 0;
      const task = resume
        ? `The owner just approved your skill "${job.resume}" – it is now in your installed skills. Now do the owner's task from the conversation, working by it. Don't search for other skills now.`
        : inPlan
        ? `The manager assigned you step ${job.step} of ${job.steps}: "${job.plan[0].request}". Do only this step, completely, as ${label(agent)}, using your installed skills (don't look for new skills now). Don't hand off; the manager coordinates the next steps.`
        : review
          ? `All the steps of your plan are done (see above). Now, as ${label('manager')}: check the results against the owner's goal${job.rounds < MAX_PLAN_ROUNDS ? ', assign a short fix-up round only if something important is missing,' : ''} and write the owner a short summary – what is ready, what waits for their approval, and the recommended next step.`
          : '';
      const r = await runAgent(client, {
        agent, notes, history: history.slice(-40), owner: owner?.name, images,
        model: MODELS[models[agent]], team, channel: app ? 'app' : 'tg',
        maagar, skills: [...designSkills(agent), ...(app && SKILL_SEEKERS.includes(agent) ? [FIND_SKILLS] : []), ...skillsOf(allSkills, agent), ...builtinSkills(agent)], pending: app ? pendingOf(allSkills, agent) : [],
        // לפני משימה חדשה: לבדוק אם יש סקיל טוב יותר (רק בשיחה רגילה באפליקציה, לא בשלב של תוכנית)
        check: app && !task && SELF_LEARNERS.includes(agent) && Boolean(this.env.GITHUB_TOKEN || this.env.MAAGAR),
        github: app && Boolean(this.env.GITHUB_TOKEN),
        bursa: app && bursaReady(this.env),
        code: app && devReady(this.env),
        create: app && FILE_MAKERS.includes(agent) && Boolean(this.env.FILES),
        imageGen: app && imagesReady(this.env),
        audio: app && AUDIO_MAKERS.includes(agent) && audioReady(this.env),
        extra: [
          agent === 'coder' && app && devReady(this.env) ? `The apps (folders in the repository):\n${appsText(await appsOf(this))}` : '',
          app && agent === 'creative' ? CODE_WORD_NOTE : '',
          // מילת הקוד "תנועה": אנימציית HTML -> סרטון (הקריאייטיב בונה, עורך הווידאו מרנדר)
          app && (agent === 'creative' || agent === 'editor') && this.env.FILES ? MOTION_NOTE : '',
          app && CREATORS.includes(agent) && this.env.FILES
            ? 'Deliver work as files in the chat: when the owner (or a teammate) wants a landing page, an illustration, a document or a table – create it with make_file (a complete, polished file), not just a description. For new images use make_image (created only after the owner approves), then place them in pages with {{file:<id>}}. When the owner wants a page live on the web at a real address (a landing page or mini-site), make it with make_file and then propose it with publish_page – it goes live after they press "publish". A mini-site is one self-contained HTML page (sections + anchor links, no other pages).'
            : '',
        ].filter(Boolean).join('\n\n'),
        gen: app && genReady(this.env),
        task, assign: agent === 'manager' && (job.rounds || 0) < MAX_PLAN_ROUNDS,
      }, tools);
      const usd = await this.addCost(r.usage, agent);
      job = { ...job, spent: (job.spent || 0) + usd };
      // נעצר באמצע (מהאפליקציה)? התשובה לא נשמרת
      if (!(await this.alive(job))) return;

      let next = r.handoff?.to || null;
      if (r.plan) {
        // המנהל חילק: השלב הראשון מתחיל, ובסוף התור חוזר אליו
        job = { ...job, plan: r.plan, step: 1, steps: r.plan.length, rounds: (job.rounds || 0) + 1 };
        next = r.plan[0].to;
      } else if (inPlan) {
        const rest = job.plan.slice(1);
        job = { ...job, plan: rest, step: job.step + 1 };
        next = rest.length ? rest[0].to : 'manager';
      }
      await this.pushHistory(key, {
        who: agent, text: r.text || '',
        ...(r.plan ? { plan: r.plan } : {}),
        ...(inPlan ? { step: { n: job.step - 1, of: job.steps } } : {}),
        ...(r.handoff ? { handoff: r.handoff } : {}),
        ...(renders.length ? { renders: renders.splice(0) } : {}),
        ...(gens.length ? { gens: gens.splice(0) } : {}),
        ...(devs.length ? { devs: devs.splice(0) } : {}),
        ...(made.length ? { files: made.splice(0) } : {}),
        ...(imgs.length ? { images: imgs.splice(0) } : {}),
        ...(sites.length ? { sites: sites.splice(0) } : {}),
        ...(posts.length ? { posts: posts.splice(0) } : {}),
        ...(audios.length ? { audios: audios.splice(0) } : {}),
        ...(proposed.length ? { skillsProposed: proposed.splice(0) } : {}),
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
      await this.notice(job, job.budget && job.spent >= job.budget
        ? `⏸️ עצרנו כי המשימה הגיעה לתקרה של $${job.budget}. לכתוב "תמשיכו" כדי להמשיך.`
        : '⏸️ עצרנו כאן כדי לא לרוץ סתם. לכתוב "תמשיכו" כדי להמשיך.', job.private ? job.via : team[0]);
    }
  }

  // who = הבוט שעבד (או 'router' – ההחלטה מי עונה), כדי לראות באפליקציה כמה כל אחד עולה
  async addCost(usage = [], who = '') {
    return this.addUsd(usage.reduce((s, u) => s + priceOf(u), 0), who);
  }

  // סכום בדולרים לחודש וליום (ולבוט). extra = מונים נוספים לחודש, למשל { devs: 1, devUsd: 2.5 }
  async addUsd(usd, who = '', extra = {}) {
    if (!usd && !Object.keys(extra).length) return 0;
    const date = israelDate();
    const key = `cost:${date.slice(0, 7)}`;
    const c = (await this.storage.get(key)) || { usd: 0, days: {} };
    c.usd += usd;
    c.days[date.slice(8)] = (c.days[date.slice(8)] || 0) + usd;
    if (who && usd) c.agents = { ...(c.agents || {}), [who]: ((c.agents || {})[who] || 0) + usd };
    for (const [k, v] of Object.entries(extra)) c[k] = (c[k] || 0) + v;
    await this.storage.put(key, c);
    return usd;
  }
}
