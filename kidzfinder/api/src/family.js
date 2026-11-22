// Durable Object אחד לכל משפחה: הורים, ילדים, מקומות, מיקום חי והתראות.
import { placesContaining, geofenceEvents, lowBatteryCrossed, distanceMeters } from './geo.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACK = 600; // מקסימום נקודות מסלול לכל ילד

const token = () => crypto.randomUUID().replace(/-/g, '');
const pairCode = () => String(Math.floor(100000 + Math.random() * 900000)); // קוד 6 ספרות
const now = () => Date.now();

// כמה התראות אחרונות לשמור
const MAX_ALERTS = 200;

export class Family {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  // קריאה/כתיבה של "המסמך" של המשפחה (הכול באובייקט אחד, פשוט לסנכרון).
  async doc() {
    return (await this.storage.get('doc')) || null;
  }
  async save(doc) {
    await this.storage.put('doc', doc);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
    const auth = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';

    try {
      // יצירת משפחה חדשה (הורה ראשון)
      if (path === '/create' && method === 'POST') {
        const parentToken = token();
        const doc = {
          id: this.state.id.toString(),
          name: body.name || 'המשפחה שלי',
          parents: [{ token: parentToken, name: body.parentName || 'הורה' }],
          children: [],
          places: [],
          live: {}, // childId -> { lat, lng, acc, battery, ts, placeIds }
          alerts: [],
          pairing: null, // { code, expires }
          created: now(),
        };
        await this.save(doc);
        return json({ ok: true, parentToken, name: doc.name });
      }

      const doc = await this.doc();
      if (!doc) return json({ error: 'not_found' }, 404);

      const isParent = doc.parents.some((p) => p.token === auth);
      const child = doc.children.find((c) => c.token === auth);

      // הורה מייצר קוד חיבור לילד חדש (תקף 10 דקות)
      if (path === '/pair-code' && method === 'POST') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        doc.pairing = { code: pairCode(), expires: now() + 10 * 60 * 1000 };
        await this.save(doc);
        return json({ ok: true, code: doc.pairing.code });
      }

      // הילד מצטרף עם הקוד
      if (path === '/pair' && method === 'POST') {
        const p = doc.pairing;
        if (!p || p.code !== String(body.code) || p.expires < now())
          return json({ error: 'bad_code' }, 400);
        const childToken = token();
        const childId = token().slice(0, 12);
        doc.children.push({
          id: childId,
          token: childToken,
          name: body.childName || 'ילד/ה',
          device: body.deviceId || '',
          joined: now(),
        });
        doc.pairing = null; // קוד לשימוש חד-פעמי
        pushAlert(doc, { type: 'joined', childId, childName: body.childName || 'ילד/ה' });
        await this.save(doc);
        return json({ ok: true, childId, childToken, familyName: doc.name });
      }

      // הילד שולח מיקום
      if (path === '/loc' && method === 'POST') {
        if (!child) return json({ error: 'forbidden' }, 403);
        const point = { lat: Number(body.lat), lng: Number(body.lng) };
        if (!isFinite(point.lat) || !isFinite(point.lng))
          return json({ error: 'bad_loc' }, 400);

        const prev = doc.live[child.id] || {};
        const nowPlaces = placesContaining(point, doc.places);
        const events = geofenceEvents(prev.placeIds || [], nowPlaces);
        for (const e of events) {
          const place = doc.places.find((pl) => pl.id === e.placeId);
          pushAlert(doc, {
            type: e.type === 'enter' ? 'arrived' : 'left',
            childId: child.id,
            childName: child.name,
            place: place?.name || '',
          });
        }
        if (lowBatteryCrossed(prev.battery, Number(body.battery)))
          pushAlert(doc, { type: 'low_battery', childId: child.id, childName: child.name, battery: Number(body.battery) });

        doc.live[child.id] = {
          lat: point.lat,
          lng: point.lng,
          acc: Number(body.acc) || null,
          battery: typeof body.battery === 'number' ? body.battery : prev.battery ?? null,
          ts: now(),
          placeIds: nowPlaces,
        };
        // מסלול היום: מוסיפים נקודה אם זזה מספיק או עבר זמן, שומרים רק 24 שעות אחרונות
        doc.tracks = doc.tracks || {};
        const track = (doc.tracks[child.id] || []).filter((p) => now() - p.ts < DAY_MS);
        const last = track[track.length - 1];
        if (!last || distanceMeters(last, point) > 20 || now() - last.ts > 5 * 60 * 1000) {
          track.push({ lat: point.lat, lng: point.lng, ts: now() });
        }
        doc.tracks[child.id] = track.slice(-MAX_TRACK);
        await this.save(doc);
        return json({ ok: true });
      }

      // ההורה מבקש את מסלול היום של ילד (GET /track?childId=...)
      if (path.startsWith('/track') && method === 'GET') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        const childId = url.searchParams.get('childId');
        const track = ((doc.tracks || {})[childId] || []).filter((p) => now() - p.ts < DAY_MS);
        return json({ ok: true, track });
      }

      // הילד לוחץ SOS
      if (path === '/sos' && method === 'POST') {
        if (!child) return json({ error: 'forbidden' }, 403);
        const live = doc.live[child.id];
        pushAlert(doc, {
          type: 'sos',
          childId: child.id,
          childName: child.name,
          lat: live?.lat ?? null,
          lng: live?.lng ?? null,
        });
        await this.save(doc);
        return json({ ok: true });
      }

      // הורה מוסיף/מעדכן מקום (גדר וירטואלית)
      if (path === '/places' && method === 'POST') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        const place = {
          id: body.id || token().slice(0, 10),
          name: body.name || 'מקום',
          lat: Number(body.lat),
          lng: Number(body.lng),
          radius: Number(body.radius) || 150,
        };
        doc.places = doc.places.filter((p) => p.id !== place.id);
        doc.places.push(place);
        await this.save(doc);
        return json({ ok: true, place });
      }

      // הורה מוחק מקום
      if (path === '/places/delete' && method === 'POST') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        doc.places = doc.places.filter((p) => p.id !== body.id);
        await this.save(doc);
        return json({ ok: true });
      }

      // הורה מבקש להתקשר / לצלצל / בדיקת "אתה בסדר?" אצל הילד (פקודות שהילד מושך)
      if (path === '/command' && method === 'POST') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        if (!['ring', 'call', 'checkin'].includes(body.action)) return json({ error: 'bad_action' }, 400);
        doc.commands = doc.commands || {};
        doc.commands[body.childId] = { action: body.action, ts: now() };
        // בדיקה = מחכים לתשובת "אני בסדר"; שומרים מתי נשלחה כדי לדעת אם לא ענו (הסלמה)
        if (body.action === 'checkin') {
          doc.checkins = doc.checkins || {};
          doc.checkins[body.childId] = { requested: now(), answered: null };
        }
        await this.save(doc);
        return json({ ok: true });
      }

      // הילד לוחץ "אני בסדר 👍" בתגובה לבדיקה
      if (path === '/checkin-reply' && method === 'POST') {
        if (!child) return json({ error: 'forbidden' }, 403);
        doc.checkins = doc.checkins || {};
        const c = doc.checkins[child.id];
        if (c) c.answered = now();
        pushAlert(doc, { type: 'checkin_ok', childId: child.id, childName: child.name });
        await this.save(doc);
        return json({ ok: true });
      }

      // הילד מושך פקודות ממתינות (ומנקה)
      if (path === '/commands' && method === 'POST') {
        if (!child) return json({ error: 'forbidden' }, 403);
        const cmd = (doc.commands || {})[child.id] || null;
        if (cmd && doc.commands) {
          delete doc.commands[child.id];
          await this.save(doc);
        }
        return json({ ok: true, command: cmd });
      }

      // ההורה קורא את המצב החי (מיקומים + מקומות + התראות)
      if (path === '/state' && method === 'GET') {
        if (!isParent) return json({ error: 'forbidden' }, 403);
        return json({
          ok: true,
          name: doc.name,
          children: doc.children.map((c) => ({
            id: c.id,
            name: c.name,
            live: doc.live[c.id] || null,
          })),
          places: doc.places,
          alerts: doc.alerts.slice(-80),
          checkins: doc.checkins || {},
        });
      }

      return json({ error: 'unknown' }, 404);
    } catch (e) {
      return json({ error: 'server', detail: String(e?.message || e) }, 500);
    }
  }
}

function pushAlert(doc, alert) {
  doc.alerts.push({ ...alert, ts: now(), seen: false });
  if (doc.alerts.length > MAX_ALERTS) doc.alerts = doc.alerts.slice(-MAX_ALERTS);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
