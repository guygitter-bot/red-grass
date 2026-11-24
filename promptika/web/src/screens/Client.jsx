// כרטיס לקוח: שם ועסק (נשמרים), ומקום לטופס הקליטה ולהצעות שיגיעו בהמשך
import { ArrowRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { go } from '../lib/route';
import { proposalCost, shekel } from '../lib/pricing';
import { Button, Card, ErrorLine, Field, inputClass } from '../components/ui';

export default function Client({ id }) {
  const [client, setClient] = useState(null);
  const [settings, setSettings] = useState(null);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('GET', `/clients/${id}`), api('GET', '/settings')])
      .then(([c, s]) => {
        setClient(c.client);
        setName(c.client.name);
        setBusiness(c.client.business);
        setSettings(s.settings);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const { client: c } = await api('PUT', `/clients/${id}`, { client: { name, business } });
      setClient(c);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm('למחוק את הלקוח? אי אפשר לבטל.')) return;
    try {
      await api('DELETE', `/clients/${id}`);
      go('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <a href="#/" className="inline-flex items-center gap-1 text-sm font-medium text-turq-ink">
        <ArrowRight size={16} aria-hidden />
        כל הלקוחות
      </a>
      <ErrorLine text={error} />
      {!client && !error && <p className="text-muted">טוען…</p>}
      {client && (
        <>
          <h1 className="text-2xl font-extrabold">{client.business || client.name}</h1>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <form onSubmit={save} className="space-y-3">
                <h2 className="font-bold">פרטים</h2>
                <Field label="שם איש הקשר">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="שם העסק">
                  <input className={inputClass} value={business} onChange={(e) => setBusiness(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">{saved ? 'נשמר ✓' : 'שמירה'}</Button>
                  <Button type="button" kind="danger" onClick={remove} className="ms-auto">
                    <Trash2 size={16} aria-hidden />
                    מחיקה
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="border-dashed">
              <h2 className="font-bold">טופס קליטה</h2>
              <p className="mt-1 text-sm text-muted">כאן יופיע הטופס: הכלים שיש לעסק, מה חסר, ועוד (9 חלקים). בקרוב.</p>
            </Card>
          </div>

          <Card>
            <h2 className="font-bold">הצעות מחיר</h2>
            {client.proposals.length === 0 ? (
              <p className="mt-1 text-sm text-muted">עוד אין הצעות. בהמשך Claude ימליץ על כלים ויעריך שעות – והסכומים יחושבו לפי ההגדרות.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {client.proposals.map((p) => {
                  const cost = proposalCost(p, settings);
                  return (
                    <li key={p.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-sm">
                      <span className="font-bold">גרסה {p.version}</span>
                      <span>{p.tools.length} כלים</span>
                      <span>הקמה {shekel(cost.build)}</span>
                      <span>חודשי {shekel(cost.monthly)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
