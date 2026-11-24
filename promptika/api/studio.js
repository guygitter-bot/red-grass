// Durable Object אחד ("main") שמחזיק את כל הנתונים: auth, settings, client:<id>
import { fail, json } from './lib/http.js';
import { requireSession } from './lib/auth.js';
import { publicRoutes, authRoutes } from './routes/auth.js';
import { settingsRoutes } from './routes/settings.js';
import { clientRoutes } from './routes/clients.js';

// הסדר חשוב: קודם הכתובות בלי כניסה, ואחרי הבדיקה – כל השאר
const PRIVATE = [authRoutes, settingsRoutes, clientRoutes];

export class Studio {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request) {
    const ctx = { method: request.method, path: new URL(request.url).pathname, request, storage: this.storage, env: this.env };
    try {
      const open = await publicRoutes(ctx);
      if (open) return open;
      await requireSession(this.storage, request.headers);
      for (const route of PRIVATE) {
        const res = await route(ctx);
        if (res) return res;
      }
      throw fail(404, 'לא נמצא');
    } catch (err) {
      if (err.status) return json({ error: err.message }, err.status);
      // בלי פרטים בלוג – רק סוג התקלה (המאגר ציבורי)
      console.error('promptika error', err?.name || 'Error');
      return json({ error: 'תקלה בשרת' }, 500);
    }
  }
}
