// הגדרות התמחור – נשמרות בשרת. כל הסכומים בהצעות מחושבים מהן
import { useEffect, useState } from 'react';
import { api, setToken } from '../lib/api';
import { Button, Card, ErrorLine, Field, inputClass } from '../components/ui';

const NUMBERS = [
  ['hourlyRate', 'תעריף לשעה (₪)', 'כל שעת עבודה בהצעה מוכפלת בזה'],
  ['hostingMonthly', 'אחסון לחודש (₪)', 'נכנס לעלות החודשית של כל הצעה'],
  ['apiMonthlyAvg', 'עלות AI ממוצעת לחודש (₪)', 'נכנס לעלות החודשית של כל הצעה'],
  ['depositPercent', 'מקדמה (%)', 'מתוך עלות ההקמה'],
  ['revisionRounds', 'סבבי תיקונים כלולים', ''],
];

export default function Settings({ onLogout }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/settings')
      .then((d) => setForm(d.settings))
      .catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form };
      for (const [k] of NUMBERS) body[k] = Number(body[k]) || 0;
      const { settings } = await api('PUT', '/settings', { settings: body });
      setForm(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api('POST', '/logout', {}).catch(() => {});
    setToken('');
    onLogout();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">הגדרות</h1>
      <ErrorLine text={error} />
      {!form && !error && <p className="text-muted">טוען…</p>}
      {form && (
        <Card>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {NUMBERS.map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    dir="ltr"
                    className={`${inputClass} text-right`}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-5 accent-orange" checked={form.vatIncluded} onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })} />
              <span>המחירים כבר כוללים מע"מ</span>
            </label>
            <Button type="submit" disabled={busy}>{saved ? 'נשמר ✓' : 'שמירה'}</Button>
          </form>
        </Card>
      )}
      <Button kind="ghost" onClick={logout}>יציאה מהמכשיר הזה</Button>
    </div>
  );
}
