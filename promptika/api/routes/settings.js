// הגדרות התמחור (תעריף לשעה, אחסון, AI, מקדמה, סבבי תיקונים, מע"מ)
import { json, readBody } from '../lib/http.js';
import { safeSettings } from '../lib/model.js';

export async function settingsRoutes({ method, path, request, storage }) {
  if (path !== '/settings') return null;
  if (method === 'GET') return json({ settings: safeSettings(await storage.get('settings')) });
  if (method === 'PUT') {
    const body = await readBody(request);
    // עדכון חלקי: שדה שלא נשלח נשאר כמו שהיה
    const settings = safeSettings({ ...safeSettings(await storage.get('settings')), ...(body.settings || body) });
    await storage.put('settings', settings);
    return json({ settings });
  }
  return null;
}
