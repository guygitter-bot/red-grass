// מסך ההמלצות ללקוח: #/client/:id/proposal/:pid – 6 סעיפים, עריכה במקום, גרסאות, הדפסה והעתקה לוואטסאפ (בלי כסף)
import { ArrowRight, Check, Copy, CopyPlus, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { duplicateProposal, newProposalId, normalizeProposal, updateProposal } from '../lib/proposals';
import { go } from '../lib/route';
import { buildSummary } from '../lib/summary';
import { useProposalSave } from '../lib/useProposalSave';
import { Button, ErrorLine, Logo } from '../components/ui';
import { NextStepSection } from '../components/proposal/Closing';
import { SpecSection, TimelineSection } from '../components/proposal/Spec';
import { BuildSection, CurrentSystemsSection, UnderstandingSection } from '../components/proposal/Understanding';

const SAVE_TEXT = { dirty: 'שומר…', saving: 'שומר…', saved: 'נשמר ✓', error: 'לא נשמר – מנסה שוב' };

export default function Proposal({ clientId, pid }) {
  const [client, setClient] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', `/clients/${clientId}`)
      .then((c) => setClient(c.client))
      .catch((e) => setError(e.message));
  }, [clientId]);

  if (error) return <ErrorLine text={error} />;
  if (!client) return <p className="text-muted">טוען…</p>;
  return <ProposalView key={clientId} client={client} pid={pid} />;
}

function ProposalView({ client, pid }) {
  const { proposals, change, status } = useProposalSave(client.id, client.proposals);
  const [copied, setCopied] = useState(false);

  const raw = proposals.find((x) => x.id === pid);
  const p = raw && normalizeProposal(raw);
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
        <p className="text-muted">הגרסה לא נמצאה.</p>
      </div>
    );
  }

  // שינוי בגרסה הזאת בלבד
  const set = (patch) => change((list) => updateProposal(list, pid, (x) => ({ ...x, ...patch })));
  const setTool = (i, patch) => set({ tools: p.tools.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  function duplicate() {
    const r = duplicateProposal(proposals, pid, Date.now(), newProposalId());
    if (!r) return;
    change(() => r.list, true);
    go(`client/${client.id}/proposal/${r.created.id}`);
  }

  async function copySummary() {
    const text = buildSummary({ business: client.business || client.name, understanding: p.understanding, tools: p.tools, nextStep: p.nextStep });
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
        <span className="flex items-center gap-2"><Logo /><span className="text-sm font-bold">Promptika – אפיון מערכות</span></span>
        <span className="text-sm">{client.business || client.name} · גרסה {p.version}{date ? ` · ${date}` : ''}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="me-auto text-2xl font-extrabold">המלצות למערכות – {client.business || client.name}</h1>
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
        <p className="text-xs text-muted">כל טקסט ומספר במסמך ניתן לעריכה – לחצו עליו. השינויים נשמרים לגרסה הזאת בלבד.</p>
      </div>

      <UnderstandingSection p={p} set={set} />
      <CurrentSystemsSection p={p} set={set} />
      <BuildSection p={p} setTool={setTool} />
      <SpecSection p={p} setTool={setTool} />
      <TimelineSection p={p} set={set} />
      <NextStepSection p={p} set={set} />
    </div>
  );
}
