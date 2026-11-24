// רשימת הלקוחות + "לקוח חדש"
import { ChevronLeft, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { go } from '../lib/route';
import { Button, Card, ErrorLine, Field, inputClass } from '../components/ui';

export default function Clients() {
  const [clients, setClients] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/clients')
      .then((d) => setClients(d.clients))
      .catch((e) => setError(e.message));
  }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { client } = await api('POST', '/clients', { name, business });
      go(`client/${client.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold">לקוחות</h1>
        <Button className="ms-auto" onClick={() => setAdding((v) => !v)}>
          <Plus size={18} aria-hidden />
          לקוח חדש
        </Button>
      </div>

      {adding && (
        <Card>
          <form onSubmit={create} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <Field label="שם איש הקשר">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="שם העסק">
              <input className={inputClass} value={business} onChange={(e) => setBusiness(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || (!name.trim() && !business.trim())}>
              יצירה
            </Button>
          </form>
        </Card>
      )}

      <ErrorLine text={error} />
      {clients === null && !error && <p className="text-muted">טוען…</p>}
      {clients?.length === 0 && (
        <Card className="text-center text-muted">עוד אין לקוחות. לחצו "לקוח חדש" כדי להתחיל.</Card>
      )}
      {clients?.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <a href={`#/client/${c.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 hover:border-turq">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-night font-bold text-orange">
                  {(c.business || c.name || '?').slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.business || c.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.business ? c.name : ''}
                    {c.proposals ? ` · ${c.proposals} הצעות` : ''}
                  </span>
                </span>
                <ChevronLeft size={18} className="text-muted" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
