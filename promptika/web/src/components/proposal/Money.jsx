// סעיפים 5-6: עלות הקמה ותחזוקה חודשית. הסכומים מחושבים בכל רינדור מההגדרות (lib/pricing.js)
import { packageCost, vatLabel } from '../../lib/pricing';
import { EditNum } from '../Editable';
import { Money, Num, Section } from './parts';

// עריכת השעות לכל כלי (לא מודפס)
export function HoursEditor({ tools, setTool, stages }) {
  const setStage = (i, key, v) => setTool(i, { buildHours: { ...stages[i], [key]: v } });
  const heads = ['אפיון', 'בנייה', 'בדיקות', 'הדרכה'];
  const keys = ['spec', 'build', 'test', 'training'];
  return (
    <div className="mb-4 overflow-x-auto rounded-lg border border-line print:hidden">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="p-2 text-start text-xs text-muted">שעות לכל כלי (הערכה) – לחצו על מספר כדי לשנות. הסכומים מתעדכנים מיד.</caption>
        <thead>
          <tr className="text-start text-muted">
            <th className="p-2 text-start font-medium">כלי</th>
            {heads.map((h) => <th key={h} className="p-1 font-medium">{h}</th>)}
            <th className="p-1 font-medium">תחזוקה בחודש</th>
            <th className="p-1 font-medium">AI בחודש (₪)</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t, i) => (
            <tr key={i} className="border-t border-line">
              <td className="p-2">{t.name || `כלי ${i + 1}`}</td>
              {keys.map((k, j) => (
                <td key={k} className="p-1 text-center"><EditNum label={`${heads[j]} – ${t.name}`} value={stages[i][k]} onChange={(v) => setStage(i, k, v)} /></td>
              ))}
              <td className="p-1 text-center"><EditNum label={`תחזוקה בחודש – ${t.name}`} value={t.monthlyHours} onChange={(v) => setTool(i, { monthlyHours: v })} /></td>
              <td className="p-1 text-center"><EditNum step={5} label={`עלות AI – ${t.name}`} value={t.apiMonthlyEstimate} onChange={(v) => setTool(i, { apiMonthlyEstimate: v })} className="w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Row = ({ label, children, strong }) => (
  <div className={`flex items-baseline justify-between gap-3 py-1 text-sm ${strong ? 'border-t border-line pt-2 font-extrabold' : ''}`}>
    <span>{label}</span>
    <span className="text-end">{children}</span>
  </div>
);

function PackageCard({ pack, settings, kind }) {
  const c = packageCost(pack.tools, settings);
  const vat = vatLabel(settings);
  const withVat = settings.vatIncluded === true;
  const total = kind === 'build' ? c.build : c.monthly;
  const totalVat = kind === 'build' ? c.buildWithVat : c.monthlyWithVat;
  return (
    <div className={`avoid-break rounded-lg border p-3 ${pack.recommended ? 'border-orange bg-soft' : 'border-line'}`}>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-extrabold">{pack.label}</h3>
        {pack.recommended && <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-bold text-night print:border print:border-black print:bg-transparent print:text-black">מומלץ</span>}
      </div>
      <p className="mb-2 text-xs text-muted">{pack.tools.map((t) => t.name).filter(Boolean).join(' · ') || 'אין כלים'}</p>
      {kind === 'build'
        ? c.buildRows.filter((r) => r.hours > 0 || pack.tools.length === 0).map((r) => (
            <Row key={r.key} label={r.label}>
              <Num v={r.hours} /> שעות × <Money v={r.rate} /> = <Money v={r.sum} />
            </Row>
          ))
        : c.monthlyLines.filter((l) => l.sum > 0 || l.key === 'work').map((l) => (
            <Row key={l.key} label={l.label}>
              {l.key === 'work' ? <><Num v={l.hours} /> שעות × <Money v={l.rate} /> = <Money v={l.sum} /></> : <Money v={l.sum} />}
            </Row>
          ))}
      <Row strong label={`סה"כ (${vat})`}><Money v={total} /></Row>
      {!withVat && <Row label={'סה"כ כולל מע"מ (18%)'}><Money v={totalVat} /></Row>}
      {kind === 'build' && <Row label={`מקדמה (${settings.depositPercent}%)`}><Money v={c.deposit} /></Row>}
    </div>
  );
}

export function PackageGrid({ packs, settings, kind }) {
  return (
    <div className={`grid gap-3 ${packs.length > 1 ? 'lg:grid-cols-3' : ''}`}>
      {packs.map((pk) => <PackageCard key={pk.key} pack={pk} settings={settings} kind={kind} />)}
    </div>
  );
}

export function BuildSection({ p, packs, settings, setTool, stages }) {
  return (
    <Section n={5} title="עלות הקמה">
      {settings.hourlyRate === 0 && (
        <p className="mb-3 rounded-lg border border-orange bg-soft p-2 text-sm print:hidden">עוד לא הוגדר תעריף לשעה, אז הסכומים אפסים. <a className="font-bold text-orange-ink underline" href="#/settings">להגדרות</a></p>
      )}
      <HoursEditor tools={p.tools} setTool={setTool} stages={stages} />
      <PackageGrid packs={packs} settings={settings} kind="build" />
    </Section>
  );
}

export function MonthlySection({ packs, settings }) {
  return (
    <Section n={6} title="תחזוקה חודשית">
      <PackageGrid packs={packs} settings={settings} kind="monthly" />
      <p className="mt-2 text-xs text-muted">תחזוקה ותמיכה לפי שעות, אחסון (פעם אחת לחבילה) ועלות שימוש ב-AI.</p>
    </Section>
  );
}
