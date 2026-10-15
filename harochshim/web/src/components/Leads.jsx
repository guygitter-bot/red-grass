// רשימת לידים עם עדכון מצב – משותף למנהל ולספק
import { useState } from 'react';
import { ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { STATUSES, STATUS_LABELS, dateTime, isStale, money, shortDate } from '../lib/format';
import { Button, Empty, ErrorLine, Field, Pill, inputClass } from './ui';

function LeadCard({ lead, names, onSave, showSupplier }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(lead.amount || '');
  const [note, setNote] = useState(lead.supplierNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stale = isStale(lead);

  const save = async (patch) => {
    setBusy(true);
    setError('');
    try {
      await onSave({ id: lead.id, ...patch });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border bg-card ${stale ? 'border-coral' : 'border-line'}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-3 text-start">
        <div className="min-w-0">
          <div className="font-bold">
            {lead.name} {lead.city && <span className="font-normal text-muted">· {lead.city}</span>}
          </div>
          <div className="truncate text-sm text-muted">
            {showSupplier && <b className="text-ink">{names.supplier(lead.supplierId)} · </b>}
            {names.offer(lead.offerId) || names.category(lead.categoryId) || 'פנייה כללית'} · {shortDate(lead.createdAt)}
          </div>
          {stale && <div className="text-xs font-bold text-coral-ink">לא טופל יותר מ-48 שעות</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lead.amount > 0 && <span className="text-sm font-bold tabular-nums">{money(lead.amount)}</span>}
          <Pill status={lead.status} />
          {open ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line p-3">
          <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 self-start rounded-xl bg-soft px-3 py-2 font-bold text-sky-ink" dir="ltr">
            <Phone size={16} /> {lead.phone}
          </a>
          {lead.summary && (
            <div className="text-sm">
              <div className="font-bold text-muted">סיכום מהעוזר החכם</div>
              <p className="whitespace-pre-line">{lead.summary}</p>
            </div>
          )}
          {lead.note && (
            <div className="text-sm">
              <div className="font-bold text-muted">הלקוח כתב</div>
              <p className="whitespace-pre-line">{lead.note}</p>
            </div>
          )}
          {lead.chat?.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-sky-ink">השיחה המלאה ({lead.chat.length} הודעות)</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {lead.chat.map((m, i) => (
                  <div key={i} className={`max-w-[90%] whitespace-pre-line rounded-xl px-3 py-1.5 ${m.role === 'user' ? 'self-start bg-soft' : 'self-end border border-line'}`}>
                    {m.text}
                  </div>
                ))}
              </div>
            </details>
          )}
          <div>
            <div className="mb-1 text-sm font-medium text-muted">מצב</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => save({ status: s })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${lead.status === s ? 'border-navy bg-navy font-bold text-white dark:border-sky dark:bg-sky dark:text-navy' : 'border-line'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <Field label="סכום העסקה (₪)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="הערה">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputClass} />
            </Field>
          </div>
          <ErrorLine error={error} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {(lead.history || []).map((h) => `${STATUS_LABELS[h.status]} ${dateTime(h.at)}`).join(' ← ')}
            </span>
            <Button kind="alt" disabled={busy} onClick={() => save({ amount, supplierNote: note })}>
              שמירה
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Leads({ leads, names, onSave, showSupplier }) {
  const [filter, setFilter] = useState('open');
  const filters = {
    open: ['פתוחים', (l) => !['won', 'lost'].includes(l.status)],
    stale: ['לא טופלו', (l) => isStale(l)],
    won: ['נסגרו', (l) => l.status === 'won'],
    all: ['הכול', () => true],
  };
  const shown = leads.filter(filters[filter][1]);
  return (
    <div className="flex flex-col gap-2">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {Object.entries(filters).map(([k, [label, fn]]) => (
          <button key={k} onClick={() => setFilter(k)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${filter === k ? 'border-sky bg-soft font-bold text-sky-ink' : 'border-line bg-card'}`}>
            {label} ({leads.filter(fn).length})
          </button>
        ))}
      </div>
      {!shown.length && <Empty>אין לידים כאן.</Empty>}
      {shown.map((l) => (
        <LeadCard key={l.id} lead={l} names={names} onSave={onSave} showSupplier={showSupplier} />
      ))}
    </div>
  );
}

// שמות לפי מזהה (ספק / הצעה / קטגוריה)
export function namer({ suppliers = [], offers = [], categories = [] }) {
  return {
    supplier: (id) => suppliers.find((x) => x.id === id)?.name || '',
    offer: (id) => offers.find((x) => x.id === id)?.title || '',
    category: (id) => categories.find((x) => x.id === id)?.name || '',
  };
}
