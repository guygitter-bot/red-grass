// מסך הצעת המחיר ללקוח: #/client/:id/proposal/:pid – 8 סעיפים, עריכה במקום, גרסאות, הדפסה והעתקה לוואטסאפ
import { ArrowRight, Check, Copy, CopyPlus, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { packagesOf, safeSettings, stageHours } from '../lib/pricing';
import { duplicateProposal, newProposalId, updateProposal } from '../lib/proposals';
import { go } from '../lib/route';
import { buildSummary } from '../lib/summary';
import { useProposalSave } from '../lib/useProposalSave';
import { Button, ErrorLine, Logo } from '../components/ui';
import { BuildSection, MonthlySection } from '../components/proposal/Money';
import { NextStepSection, TermsSection } from '../components/proposal/Closing';
import { RecommendSection, SpecSection, TimelineSection, UnderstandingSection } from '../components/proposal/Understanding';

const SAVE_TEXT = { dirty: 'שומר…', saving: 'שומר…', saved: 'נשמר ✓', error: 'לא נשמר – מנסה שוב' };

export default function Proposal({ clientId, pid }) {
  const [client, setClient] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', `/clients/${clientId}`)
      .then((c) => setClient(c.client))
      .catch((e) => setError(e.message));
    const loadSettings = () => api('GET', '/settings').then((s) => setSettings(safeSettings(s.settings))).catch((e) => setError(e.message));
    loadSettings();
    // חזרה מהגדרות (או מלשונית אחרת) – מרעננים, והסכומים מתעדכנים
    window.addEventListener('focus', loadSettings);
    return () => {
      window.removeEventListener('focus', loadSettings);
    };
  }, [clientId]);

  if (error) return <ErrorLine text={error} />;
  if (!client || !settings) return <p className="text-muted">טוען…</p>;
  return <ProposalView key={clientId} client={client} settings={settings} pid={pid} />;
}

function ProposalView({ client, settings, pid }) {
  const { proposals, change, status } = useProposalSave(client.id, client.proposals);
  const [single, setSingle] = useState(false);
  const [copied, setCopied] = useState(false);

  const p = proposals.find((x) => x.id === pid);
  const back = (
    <a href={`#/client/${client.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-turq-ink print:hidden">
      <ArrowRight size={16} aria-hidden />
      חזרה ללקוח
    </a>
  );
  if (!p) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-muted">ההצעה לא נמצאה.</p>
      </div>
    );
  }

  // שינוי בגרסה הזאת בלבד
  const set = (patch) => change((list) => updateProposal(list, pid, (x) => ({ ...x, ...patch })));
  const setTool = (i, patch) => set({ tools: p.tools.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const packs = packagesOf(p.tools, single);
  const stages = p.tools.map(stageHours);

  function duplicate() {
    const r = duplicateProposal(proposals, pid, Date.now(), newProposalId());
    if (!r) return;
    change(() => r.list, true);
    go(`client/${client.id}/proposal/${r.created.id}`);
  }

  async function copySummary() {
    const pack = packs.length > 1 ? packs[1] : packs[0];
    const text = buildSummary({ business: client.business || client.name, tools: pack.tools, settings, nextStep: p.nextStep, packageLabel: packs.length > 1 ? pack.label : '' });
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const date = p.createdAt > 0 ? new Date(p.createdAt).toLocaleDateString('he-IL') : '';
  return (
    <div className="space-y-4">
      {back}

      {/* כותרת מותג – רק בהדפסה */}
      <div className="hidden items-center justify-between border-b-2 border-black pb-2 print:flex">
        <Logo />
        <span className="text-sm">{client.business || client.name} · גרסה {p.version}{date ? ` · ${date}` : ''}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="me-auto text-2xl font-extrabold">הצעה – {client.business || client.name}</h1>
        <span className="text-sm text-muted" role="status" aria-live="polite">{SAVE_TEXT[status] || ''}</span>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-card p-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            גרסה
            <select
              className="rounded-lg border border-line bg-card px-2 py-2 text-ink"
              value={pid}
              onChange={(e) => go(`client/${client.id}/proposal/${e.target.value}`)}
            >
              {[...proposals].sort((a, b) => b.version - a.version).map((x) => (
                <option key={x.id} value={x.id}>גרסה {x.version}{x.createdAt ? ` · ${new Date(x.createdAt).toLocaleDateString('he-IL')}` : ''}</option>
              ))}
            </select>
          </label>
          <Button kind="ghost" onClick={duplicate}>
            <CopyPlus size={18} aria-hidden />
            שכפול לגרסה חדשה
          </Button>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="סוג הצעה">
            {[[true, 'חבילה אחת'], [false, '3 חבילות']].map(([v, label]) => (
              <button
                key={label}
                aria-pressed={single === v}
                onClick={() => setSingle(v)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${single === v ? 'bg-night text-orange' : 'text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>
            <Printer size={18} aria-hidden />
            הדפסה / PDF
          </Button>
          <Button kind="ghost" onClick={copySummary}>
            {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
            {copied ? 'הועתק ✓' : 'העתקה לוואטסאפ'}
          </Button>
        </div>
        <p className="text-xs text-muted">כל טקסט ומספר בהצעה ניתן לעריכה – לחצו עליו. השינויים נשמרים לגרסה הזאת בלבד.</p>
      </div>

      <UnderstandingSection p={p} set={set} />
      <RecommendSection p={p} setTool={setTool} />
      <SpecSection p={p} setTool={setTool} />
      <TimelineSection p={p} set={set} />
      <BuildSection p={p} packs={packs} settings={settings} setTool={setTool} stages={stages} />
      <MonthlySection packs={packs} settings={settings} />
      <TermsSection settings={settings} p={p} set={set} />
      <NextStepSection p={p} set={set} />
    </div>
  );
}
