import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Family } from '../src/family.js';

// אחסון בזיכרון שמחקה את state.storage של Durable Object
function makeFamily(idStr = 'fam1') {
  const map = new Map();
  const state = {
    id: { toString: () => idStr },
    storage: {
      async get(k) { return map.get(k); },
      async put(k, v) { map.set(k, v); },
    },
  };
  return new Family(state);
}

function req(path, { method = 'POST', body, auth } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', 'Bearer ' + auth);
  const init = { method, headers };
  if (method === 'POST') init.body = JSON.stringify(body || {});
  return new Request('https://do.local' + path, init);
}
const call = async (fam, ...args) => (await fam.fetch(req(...args))).json();

test('יצירה → חיבור ילד בקוד → מיקום', async () => {
  const fam = makeFamily();
  const created = await call(fam, '/create', { body: { name: 'משפחת כהן', parentName: 'אמא' } });
  assert.ok(created.parentToken);
  const parent = created.parentToken;

  const code = await call(fam, '/pair-code', { auth: parent });
  assert.match(code.code, /^\d{6}$/);

  const paired = await call(fam, '/pair', { body: { code: code.code, childName: 'נועה' } });
  assert.ok(paired.childToken && paired.childId);

  // קוד לשימוש חד-פעמי
  const again = await call(fam, '/pair', { body: { code: code.code, childName: 'שוב' } });
  assert.equal(again.error, 'bad_code');

  const loc = await call(fam, '/loc', { auth: paired.childToken, body: { lat: 32.08, lng: 34.78, battery: 90 } });
  assert.ok(loc.ok);

  const state = await call(fam, '/state', { method: 'GET', auth: parent });
  assert.equal(state.children.length, 1);
  assert.equal(state.children[0].name, 'נועה');
  assert.equal(Math.round(state.children[0].live.lat * 100), 3208);
});

test('מקום (geofence) → התראת הגעה ויציאה', async () => {
  const fam = makeFamily('fam2');
  const parent = (await call(fam, '/create', {})).parentToken;
  const code = (await call(fam, '/pair-code', { auth: parent })).code;
  const kid = await call(fam, '/pair', { body: { code, childName: 'דן' } });

  await call(fam, '/places', { auth: parent, body: { name: 'בית ספר', lat: 32.08, lng: 34.78, radius: 150 } });

  await call(fam, '/loc', { auth: kid.childToken, body: { lat: 32.5, lng: 34.78, battery: 80 } }); // רחוק
  await call(fam, '/loc', { auth: kid.childToken, body: { lat: 32.0805, lng: 34.7805, battery: 80 } }); // הגיע
  await call(fam, '/loc', { auth: kid.childToken, body: { lat: 32.5, lng: 34.78, battery: 80 } }); // יצא

  const state = await call(fam, '/state', { method: 'GET', auth: parent });
  const types = state.alerts.map((a) => a.type);
  assert.ok(types.includes('arrived'), 'חסרה התראת הגעה');
  assert.ok(types.includes('left'), 'חסרה התראת יציאה');
});

test('SOS ו-סוללה חלשה יוצרים התראות', async () => {
  const fam = makeFamily('fam3');
  const parent = (await call(fam, '/create', {})).parentToken;
  const code = (await call(fam, '/pair-code', { auth: parent })).code;
  const kid = await call(fam, '/pair', { body: { code, childName: 'יעל' } });

  await call(fam, '/loc', { auth: kid.childToken, body: { lat: 32.08, lng: 34.78, battery: 50 } });
  await call(fam, '/loc', { auth: kid.childToken, body: { lat: 32.08, lng: 34.78, battery: 10 } });
  await call(fam, '/sos', { auth: kid.childToken, body: {} });

  const state = await call(fam, '/state', { method: 'GET', auth: parent });
  const types = state.alerts.map((a) => a.type);
  assert.ok(types.includes('low_battery'));
  assert.ok(types.includes('sos'));
});

test('הורה בלבד רואה מצב; טוקן לא נכון נחסם', async () => {
  const fam = makeFamily('fam4');
  const parent = (await call(fam, '/create', {})).parentToken;
  const bad = await call(fam, '/state', { method: 'GET', auth: 'xxx' });
  assert.equal(bad.error, 'forbidden');
  const ok = await call(fam, '/state', { method: 'GET', auth: parent });
  assert.ok(ok.ok);
});

test('בדיקה "אתה בסדר?" – הילד מאשר, המצב מתעדכן', async () => {
  const fam = makeFamily('fam6');
  const parent = (await call(fam, '/create', {})).parentToken;
  const code = (await call(fam, '/pair-code', { auth: parent })).code;
  const kid = await call(fam, '/pair', { body: { code, childName: 'תמר' } });

  await call(fam, '/command', { auth: parent, body: { childId: kid.childId, action: 'checkin' } });
  let state = await call(fam, '/state', { method: 'GET', auth: parent });
  assert.ok(state.checkins[kid.childId].requested);
  assert.equal(state.checkins[kid.childId].answered, null); // עדיין לא ענה

  // הילד מושך את הפקודה ומגיב "אני בסדר"
  const cmd = await call(fam, '/commands', { auth: kid.childToken, body: {} });
  assert.equal(cmd.command.action, 'checkin');
  await call(fam, '/checkin-reply', { auth: kid.childToken, body: {} });

  state = await call(fam, '/state', { method: 'GET', auth: parent });
  assert.ok(state.checkins[kid.childId].answered);
  assert.ok(state.alerts.map((a) => a.type).includes('checkin_ok'));
});

test('פקודת צלצול מההורה נמשכת פעם אחת אצל הילד', async () => {
  const fam = makeFamily('fam5');
  const parent = (await call(fam, '/create', {})).parentToken;
  const code = (await call(fam, '/pair-code', { auth: parent })).code;
  const kid = await call(fam, '/pair', { body: { code, childName: 'גיא' } });

  await call(fam, '/command', { auth: parent, body: { childId: kid.childId, action: 'ring' } });
  const first = await call(fam, '/commands', { auth: kid.childToken, body: {} });
  assert.equal(first.command.action, 'ring');
  const second = await call(fam, '/commands', { auth: kid.childToken, body: {} });
  assert.equal(second.command, null); // כבר נמשכה
});
