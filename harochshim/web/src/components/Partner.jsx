// האפליקציה של הספק: רק הלידים שלו וההצעות שלו. הכניסה בקישור אישי (#/partner/<סוד>)
import { useCallback, useEffect, useState } from 'react';
import { FileText, LogOut } from 'lucide-react';
import { api, load, store } from '../lib/api';
import { openFile, STATUS_LABELS } from '../lib/format';
import { Empty, ErrorLine, Price, TopBar } from './ui';
import Leads, { namer } from './Leads';

export default function Partner({ secret }) {
  // הסוד מהקישור נשמר בטלפון, ומוחקים אותו מהכתובת
  const [token, setToken] = useState(() => secret || load('hr_partner', ''));
  useEffect(() => {
    if (secret) {
      store('hr_partner', secret);
      window.history.replaceState(null, '', '#/partner');
    }
  }, [secret]);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('leads');

  const refresh = useCallback(async () => {
    try {
      setData(await api('/partner/state', {}, token));
      setError('');
    } catch (e) {
      setError(e.status === 401 ? 'הקישור לא בתוקף. בקשו קישור חדש מהרוכשים.' : e.message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [token, refresh]);

  const saveLead = async (patch) => {
    const { lead } = await api('/partner/lead', patch, token);
    setData((d) => ({ ...d, leads: d.leads.map((l) => (l.id === lead.id ? lead : l)) }));
  };

  const logout = () => {
    store('hr_partner', null);
    setToken('');
    setData(null);
  };

  if (!token) {
    return (
      <>
        <TopBar title="אזור הספקים" />
        <main className="mx-auto max-w-lg px-4 py-8">
          <Empty>כדי להיכנס, פתחו את הקישור האישי שקיבלתם מהרוכשים.</Empty>
        </main>
      </>
    );
  }

  const names = data ? namer({ suppliers: [data.supplier], offers: data.offers, categories: data.categories }) : null;
  const counts = data ? Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, data.leads.filter((l) => l.status === s).length])) : {};

  return (
    <>
      <TopBar title={data?.supplier.name || 'אזור הספקים'} sub="הלידים שלכם מהרוכשים">
        <button onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="יציאה">
          <LogOut size={18} />
        </button>
      </TopBar>
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5">
        <ErrorLine error={error} />
        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['חדשים', counts.new],
                ['בטיפול', counts.contacted + counts.quoted],
                ['נסגרו', counts.won],
                ['סה״כ', data.leads.length],
              ].map(([label, n]) => (
                <div key={label} className="rounded-2xl border border-line bg-card p-3">
                  <div className="text-2xl font-extrabold tabular-nums">{n}</div>
                  <div className="text-sm text-muted">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-1 rounded-2xl bg-card p-1">
              {[
                ['leads', 'לידים'],
                ['offers', 'ההצעות שלנו'],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-xl py-2 font-bold ${tab === k ? 'bg-navy text-white dark:bg-sky dark:text-navy' : 'text-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'leads' ? (
              <Leads leads={data.leads} names={names} onSave={saveLead} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted">כך הלקוחות רואים את ההצעות שלכם. לשינוי – פנו להרוכשים.</p>
                {!data.offers.length && <Empty>עוד אין הצעות.</Empty>}
                {data.offers.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-line bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <b>{o.title}</b>
                      {!o.active && <span className="text-xs text-muted">מוסתרת</span>}
                    </div>
                    <Price offer={o} />
                    {o.details && <p className="whitespace-pre-line text-sm text-muted">{o.details}</p>}
                    {o.file && (
                      <button onClick={async () => openFile((await api('/partner/file', { id: o.id }, token)).file)} className="mt-1 flex items-center gap-1 text-sm text-sky-ink underline">
                        <FileText size={14} /> {o.file.name}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
