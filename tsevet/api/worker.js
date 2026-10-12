// צוות – שרת הבוטים ב-Telegram (Cloudflare Worker).
//   POST /tg/<agent>  – עדכונים מ-Telegram (בודקים את הסיסמה ש-Telegram שולחת), נכנסים לתור של הצוות
//   POST /setup       – הקמה אחרי כל עלייה: כתובת, שם, תיאור ופקודות לכל בוט (נקרא מ-.github/workflows/tsevet.yml)
import { AGENTS, AGENT_KEYS, label } from './agents.js';
import { hookSecret, tg, tokenOf } from './telegram.js';

export { Team } from './team.js';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const team = (env) => env.TEAM.get(env.TEAM.idFromName('main'));

const COMMANDS = [
  { command: 'costs', description: 'כמה זה עלה' },
  { command: 'memory', description: 'מה הצוות זוכר' },
  { command: 'reset', description: 'להתחיל את הנושא הזה מחדש' },
  { command: 'help', description: 'איך עובדים עם הצוות' },
];

async function setup(request, env) {
  const first = tokenOf(env, AGENT_KEYS[0]);
  if (!first || request.headers.get('x-setup') !== (await hookSecret(`setup:${first}`))) return json(401, { error: 'unauthorized' });
  const origin = new URL(request.url).origin;
  const bots = {};
  const report = {};
  for (const agent of AGENT_KEYS) {
    const token = tokenOf(env, agent);
    if (!token) {
      report[agent] = 'missing token';
      continue;
    }
    const me = await tg(env, token, 'getMe', {});
    bots[agent] = { id: me.id, username: me.username };
    await tg(env, token, 'setWebhook', {
      url: `${origin}/tg/${agent}`,
      secret_token: await hookSecret(token),
      allowed_updates: ['message'],
    });
    // שם, תיאור ופקודות – לא קריטי (Telegram מגביל שינוי שם בתדירות גבוהה)
    const extras = [
      ['setMyName', { name: label(agent) }],
      ['setMyShortDescription', { short_description: `${label(agent)} – ${AGENTS[agent].short}` }],
      ['setMyDescription', { description: `${label(agent)} מצוות השיווק: ${AGENTS[agent].short}.\nבוט פרטי.` }],
      ['setMyCommands', { commands: COMMANDS }],
    ];
    for (const [method, body] of extras) {
      try {
        await tg(env, token, method, body);
      } catch (e) {
        console.log(method, e.message);
      }
    }
    report[agent] = `@${me.username}`;
  }
  await team(env).fetch('https://team/bots', { method: 'POST', body: JSON.stringify({ bots }) });
  return json(200, report);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/') return new Response('צוות 🤖');
    if (request.method !== 'POST') return json(405, { error: 'method' });
    if (pathname === '/setup') return setup(request, env);

    const agent = pathname.match(/^\/tg\/(\w+)$/)?.[1];
    if (!agent || !AGENT_KEYS.includes(agent)) return json(404, { error: 'not found' });
    const token = tokenOf(env, agent);
    if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== (await hookSecret(token))) {
      return json(401, { error: 'unauthorized' });
    }
    const update = await request.json().catch(() => null);
    if (update) await team(env).fetch('https://team/update', { method: 'POST', body: JSON.stringify({ agent, update }) });
    return new Response('ok');
  },
};
