import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceMeters,
  placesContaining,
  geofenceEvents,
  lowBatteryCrossed,
  isStale,
} from '../src/geo.js';

test('distanceMeters – אותה נקודה = 0', () => {
  const p = { lat: 32.08, lng: 34.78 };
  assert.equal(distanceMeters(p, p), 0);
});

test('distanceMeters – ~111 ק"מ למעלה אחת של קו רוחב', () => {
  const d = distanceMeters({ lat: 32, lng: 34 }, { lat: 33, lng: 34 });
  assert.ok(d > 110000 && d < 112000, `got ${d}`);
});

test('placesContaining – בתוך הרדיוס בלבד', () => {
  const school = { id: 'school', lat: 32.08, lng: 34.78, radius: 150 };
  const far = { id: 'far', lat: 32.5, lng: 34.78, radius: 150 };
  const inside = placesContaining({ lat: 32.0805, lng: 34.7805 }, [school, far]);
  assert.deepEqual(inside, ['school']);
});

test('placesContaining – ברירת מחדל רדיוס 100 מ׳', () => {
  const home = { id: 'home', lat: 32.08, lng: 34.78 };
  assert.deepEqual(placesContaining({ lat: 32.08, lng: 34.78 }, [home]), ['home']);
  assert.deepEqual(placesContaining({ lat: 32.09, lng: 34.78 }, [home]), []);
});

test('geofenceEvents – כניסה ויציאה', () => {
  assert.deepEqual(geofenceEvents([], ['school']), [{ type: 'enter', placeId: 'school' }]);
  assert.deepEqual(geofenceEvents(['school'], []), [{ type: 'exit', placeId: 'school' }]);
  assert.deepEqual(geofenceEvents(['home'], ['home']), []);
});

test('geofenceEvents – מעבר ממקום למקום', () => {
  const ev = geofenceEvents(['home'], ['school']);
  assert.ok(ev.some((e) => e.type === 'exit' && e.placeId === 'home'));
  assert.ok(ev.some((e) => e.type === 'enter' && e.placeId === 'school'));
});

test('lowBatteryCrossed – רק כשחוצים את הסף כלפי מטה', () => {
  assert.equal(lowBatteryCrossed(40, 12), true);
  assert.equal(lowBatteryCrossed(12, 10), false); // כבר היה מתחת
  assert.equal(lowBatteryCrossed(40, 50), false);
  assert.equal(lowBatteryCrossed(undefined, 10), true); // עדכון ראשון ונמוך
});

test('isStale – מיקום ישן מדי', () => {
  const now = 1_000_000_000;
  assert.equal(isStale(now - 60_000, now), false);
  assert.equal(isStale(now - 20 * 60_000, now), true);
  assert.equal(isStale(null, now), true);
});
