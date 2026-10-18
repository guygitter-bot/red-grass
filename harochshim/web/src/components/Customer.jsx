// המסכים של הלקוח: הבית (קטגוריות), קטגוריה (ספקים והצעות), ספק (הצעות + עוזר + פנייה), הפניות שלי
import { useEffect, useMemo, useState } from 'react';
import { FileText, MessageCircle, Phone, Search } from 'lucide-react';
import { api, load } from '../lib/api';
import { openFile, shortDate } from '../lib/format';
import { Empty, ErrorLine, Pill, Price, Stripes, TopBar } from './ui';
import Chat from './Chat';
import LeadForm from './LeadForm';

function OfferCard({ offer, supplier, onAsk, onLead, showSupplier }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const showFile = async () => {
    setBusy(true);
    setError('');
    try {
      openFile((await api('/file', { id: offer.id })).file);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showSupplier && (
            <a href={`#/s/${supplier.id}`} className="text-sm font-bold text-sky-ink hover:underline">
              {supplier.name}
            </a>
          )}
          <div className="font-bold">{offer.title}</div>
        </div>
        {offer.hot && <span className="shrink-0 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-navy">הטבה חמה</span>}
      </div>
      <Price offer={offer} />
      {offer.details && <p className="whitespace-pre-line text-sm text-muted">{offer.details}</p>}
      {offer.validUntil && <div className="text-xs text-muted">בתוקף עד {offer.validUntil.split('-').reverse().join('.')}</div>}
      <ErrorLine error={error} />
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button onClick={() => onLead(offer)} className="flex-1 rounded-xl bg-coral px-3 py-2 text-sm font-bold text-white">
          שיחזרו אליי
        </button>
        <button onClick={() => onAsk(offer)} className="flex items-center gap-1 rounded-xl bg-sky px-3 py-2 text-sm font-bold text-navy">
          <MessageCircle size={16} /> שאלה
        </button>
        {offer.file && (
          <button onClick={showFile} disabled={busy} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm">
            <FileText size={16} /> {busy ? 'פותח…' : 'הצעת המחיר'}
          </button>
        )}
      </div>
    </div>
  );
}

// מחזיק את החלונות (שיחה / טופס) לכל מסך שמציג הצעות
function useContact() {
  const [chat, setChat] = useState(null); // { supplier, offer }
  const [lead, setLead] = useState(null); // { supplier, offer, summary, chat }
  const sheets = (
    <>
      {chat && (
        <Chat
          supplier={chat.supplier}
          offer={chat.offer}
          onClose={() => setChat(null)}
          onHandoff={(summary, messages) => {
            setLead({ supplier: chat.supplier, offer: chat.offer, summary, chat: messages });
            setChat(null);
          }}
        />
      )}
      {lead && <LeadForm {...lead} onClose={() => setLead(null)} />}
    </>
  );
  return { ask: (supplier, offer) => setChat({ supplier, offer }), contact: (supplier, offer) => setLead({ supplier, offer }), sheets };
}

export function Home({ catalog }) {
  const [q, setQ] = useState('');
  const { ask, contact, sheets } = useContact();
  const sup = (id) => catalog.suppliers.find((s) => s.id === id);
  const query = q.trim();
  const results = useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    return catalog.offers.filter((o) => {
      const s = sup(o.supplierId);
      const cat = catalog.categories.find((c) => c.id === o.categoryId);
      const hay = `${o.title} ${o.details} ${s?.name} ${cat?.name}`;
      return words.every((w) => hay.includes(w));
    });
  }, [query, catalog]);
  const hot = catalog.offers.filter((o) => o.hot);
  const count = (catId) => catalog.offers.filter((o) => o.categoryId === catId).length;
  const myCount = load('hr_my', []).length;

  return (
    <>
      <TopBar>
        {myCount > 0 && (
          <a href="#/my" className="rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium">
            הפניות שלי ({myCount})
          </a>
        )}
      </TopBar>
      <div className="bg-navy pb-6 text-white">
        <div className="mx-auto max-w-5xl px-4 pt-2">
          <h1 className="text-2xl font-extrabold lg:text-3xl">תנו לנו לחסוך בשבילכם</h1>
          <p className="mt-1 text-white/70">מחירים של חברי הקבוצה אצל ספקים לבית: בוחרים הטבה, והספק חוזר אליכם.</p>
          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-ink dark:bg-navy-2 dark:text-white">
            <Search size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: מקלחון, מזגן, תאורה…" className="w-full bg-transparent text-base outline-none" />
          </label>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-5">
        {query ? (
          <section>
            <h2 className="mb-3 font-bold">{results.length ? `${results.length} הטבות` : 'לא נמצאו הטבות'}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((o) => (
                <OfferCard key={o.id} offer={o} supplier={sup(o.supplierId)} showSupplier onAsk={() => ask(sup(o.supplierId), o)} onLead={() => contact(sup(o.supplierId), o)} />
              ))}
            </div>
          </section>
        ) : (
          <>
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Stripes /> קטגוריות
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {catalog.categories.map((c) => (
                  <a key={c.id} href={`#/c/${c.id}`} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card px-2 py-4 text-center hover:border-sky">
                    <span className="text-3xl">{c.emoji}</span>
                    <span className="text-sm font-bold">{c.name}</span>
                    <span className="text-xs text-muted">{count(c.id) ? `${count(c.id)} הטבות` : 'בקרוב'}</span>
                  </a>
                ))}
              </div>
            </section>
            {hot.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <span className="rounded bg-sun px-1.5 text-navy">חם</span> הטבות חמות
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hot.map((o) => (
                    <OfferCard key={o.id} offer={o} supplier={sup(o.supplierId)} showSupplier onAsk={() => ask(sup(o.supplierId), o)} onLead={() => contact(sup(o.supplierId), o)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {sheets}
    </>
  );
}

export function CategoryPage({ catalog, id }) {
  const cat = catalog.categories.find((c) => c.id === id);
  const { ask, contact, sheets } = useContact();
  if (!cat) return <NotFound />;
  const suppliers = catalog.suppliers.filter((s) => s.categoryIds.includes(id) || catalog.offers.some((o) => o.supplierId === s.id && o.categoryId === id));
  return (
    <>
      <TopBar back="#/" title={`${cat.emoji} ${cat.name}`} sub={suppliers.length ? `${suppliers.length} ספקים` : ''} />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-5">
        {!suppliers.length && <Empty>עוד אין ספקים בקטגוריה הזאת. בקרוב!</Empty>}
        {suppliers.map((s) => {
          const offers = catalog.offers.filter((o) => o.supplierId === s.id && o.categoryId === id);
          return (
            <section key={s.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <a href={`#/s/${s.id}`} className="min-w-0">
                  <h2 className="text-lg font-bold hover:underline">{s.name}</h2>
                  {s.area && <div className="text-sm text-muted">{s.area}</div>}
                </a>
                <button onClick={() => ask(s, null)} className="flex items-center gap-1 rounded-xl bg-soft px-3 py-1.5 text-sm font-bold text-sky-ink">
                  <MessageCircle size={16} /> לשאול את העוזר של {s.name}
                </button>
              </div>
              {offers.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {offers.map((o) => (
                    <OfferCard key={o.id} offer={o} supplier={s} onAsk={() => ask(s, o)} onLead={() => contact(s, o)} />
                  ))}
                </div>
              ) : (
                <button onClick={() => contact(s, null)} className="w-full rounded-2xl border border-line bg-card p-4 text-start text-sm">
                  ההטבות של {s.name} יעלו בקרוב. <b className="text-coral-ink">להשאיר פרטים ←</b>
                </button>
              )}
            </section>
          );
        })}
      </main>
      {sheets}
    </>
  );
}

export function SupplierPage({ catalog, id }) {
  const s = catalog.suppliers.find((x) => x.id === id);
  const { ask, contact, sheets } = useContact();
  if (!s) return <NotFound />;
  const offers = catalog.offers.filter((o) => o.supplierId === id);
  const cats = catalog.categories.filter((c) => s.categoryIds.includes(c.id));
  return (
    <>
      <TopBar back={cats[0] ? `#/c/${cats[0].id}` : '#/'} title={s.name} sub={[cats.map((c) => c.name).join(' · '), s.area].filter(Boolean).join(' | ')} />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5">
        {s.about && <p className="whitespace-pre-line text-muted">{s.about}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => ask(s, null)} className="flex items-center justify-center gap-2 rounded-2xl bg-sky px-4 py-3 font-bold text-navy">
            <MessageCircle size={18} /> לשאול את העוזר החכם
          </button>
          <button onClick={() => contact(s, null)} className="flex items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-3 font-bold text-white">
            <Phone size={18} /> שהספק יחזור אליי
          </button>
        </div>
        {s.website && (
          <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-ink underline">
            לאתר של {s.name}
          </a>
        )}
        <h2 className="mt-2 flex items-center gap-2 text-lg font-bold">
          <Stripes /> ההטבות לחברי הרוכשים
        </h2>
        {offers.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} supplier={s} onAsk={() => ask(s, o)} onLead={() => contact(s, o)} />
            ))}
          </div>
        ) : (
          <Empty>ההטבות יעלו בקרוב.</Empty>
        )}
      </main>
      {sheets}
    </>
  );
}

export function MyRequests() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/my', { items: load('hr_my', []) })
      .then((r) => setLeads(r.leads))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <TopBar back="#/" title="הפניות שלי" />
      <main className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-5">
        <ErrorLine error={error} />
        {leads && !leads.length && <Empty>עוד לא פניתם לספקים.</Empty>}
        {leads?.map((l) => (
          <a key={l.id} href={`#/s/${l.supplierId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
            <div className="min-w-0">
              <div className="font-bold">{l.supplierName}</div>
              <div className="truncate text-sm text-muted">
                {l.offerTitle || 'פנייה כללית'} · {shortDate(l.createdAt)}
              </div>
            </div>
            <Pill status={l.status} />
          </a>
        ))}
        <p className="mt-2 text-sm text-muted">הספק לא חזר אליכם תוך יומיים? ספרו לנו ונטפל בזה.</p>
      </main>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <TopBar back="#/" title="לא נמצא" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Empty>
          הדף הזה לא קיים או שההטבה כבר לא פעילה. <a href="#/" className="text-sky-ink underline">לכל ההטבות</a>
        </Empty>
      </main>
    </>
  );
}
