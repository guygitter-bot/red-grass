// טופס "שיחזרו אליי": שם, טלפון, עיר. הפרטים נשמרים בטלפון לפעם הבאה
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, load, store } from '../lib/api';
import { Button, ErrorLine, Field, Sheet, inputClass } from './ui';

export default function LeadForm({ supplier, offer, summary, chat, onClose }) {
  const me = load('hr_me', {});
  const [name, setName] = useState(me.name || '');
  const [phone, setPhone] = useState(me.phone || '');
  const [city, setCity] = useState(me.city || '');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(!!me.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/lead', { supplierId: supplier.id, offerId: offer?.id || '', name, phone, city, note, consent, summary: summary || '', chat: chat || [] });
      store('hr_me', { name, phone, city });
      const mine = load('hr_my', []).filter((x) => x.id !== res.id);
      store('hr_my', [{ id: res.id, key: res.key }, ...mine].slice(0, 50));
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Sheet title="הפנייה נשלחה" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 size={48} className="text-sky" />
          <p className="text-lg font-bold">{supplier.name} יחזרו אליכם בקרוב.</p>
          <p className="text-muted">אפשר לראות את מצב הפנייה ב"הפניות שלי".</p>
          <div className="flex gap-2">
            <a href="#/my" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 font-bold">
              הפניות שלי
            </a>
            <Button onClick={onClose}>סגירה</Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`שיחזרו אליי – ${supplier.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        {offer && (
          <div className="rounded-xl bg-soft px-3 py-2 text-sm">
            לגבי: <b>{offer.title}</b>
          </div>
        )}
        {summary && (
          <div className="rounded-xl border border-line px-3 py-2 text-sm">
            <div className="mb-0.5 font-bold text-muted">מה יעבור לספק מהשיחה:</div>
            {summary}
          </div>
        )}
        <Field label="שם">
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="טלפון">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" dir="ltr" className={`${inputClass} text-right`} />
        </Field>
        <Field label="עיר (לא חובה)">
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} className={inputClass} />
        </Field>
        <Field label="משהו שחשוב שהספק ידע? (לא חובה)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="למשל: מתי נוח לדבר" className={inputClass} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-coral" />
          <span>אני מאשר/ת להעביר את הפרטים שלי ל{supplier.name} ולהרוכשים, כדי שיחזרו אליי לגבי הפנייה.</span>
        </label>
        <ErrorLine error={error} />
        <Button type="submit" disabled={busy || !consent}>
          {busy ? 'שולח…' : 'שליחה לספק'}
        </Button>
      </form>
    </Sheet>
  );
}
