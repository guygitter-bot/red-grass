import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';

test('הבנייה יוצרת אפליקציה עם כל הפרקים', () => {
  execFileSync('node', ['build.mjs']);
  const html = fs.readFileSync('dist/index.html', 'utf8');
  assert.match(html, /<script src="app.js"><\/script>/);
  assert.doesNotMatch(html, /<script>/); // בלי סקריפט בתוך הדף (CSP)
  const js = fs.readFileSync('dist/app.js', 'utf8');
  new vm.Script(js); // תחביר תקין
  // מריצים את התוכן בלי דפדפן ובודקים שכל פרק נבנה
  const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => ({ insertAdjacentHTML() {} }), getElementById: () => ({}) }, location: { hash: '' }, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, console };
  vm.createContext(ctx);
  vm.runInContext(js.replace(/boot\(\);\s*courseSyncStart\(\);\s*$/, '') + '\n;globalThis.__n = MODULES.map(m => m.body().length > 100).filter(Boolean).length;', ctx);
  assert.equal(ctx.__n, 18);
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'img/yt-ypp.jpg']) assert.ok(fs.existsSync('dist/' + f), f);
});
