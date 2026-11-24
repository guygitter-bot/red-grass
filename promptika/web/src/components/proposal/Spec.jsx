// סעיפים 4-5: אפיון לכל מערכת (כולל הערכת זמן בנייה לתכנון פנימי), לוח זמנים
import { Plus, X } from 'lucide-react';
import { stagesOf, totalHours } from '../../lib/proposals';
import { EditLines, EditNum, EditText } from '../Editable';
import { Section } from './parts';

const STAGES = [['spec', 'אפיון'], ['build', 'בנייה'], ['test', 'בדיקות'], ['training', 'הדרכה']];

export function SpecSection({ p, setTool }) {
  const field = (t, i, key, label) => (
    <div>
      <span className="text-sm font-medium text-muted">{label}</span>
      <EditText label={label} className="text-sm" value={t[key]} onChange={(v) => setTool(i, { [key]: v })} />
    </div>
  );
  const lines = (t, i, key, label) => (
    <div>
      <span className="text-sm font-medium text-muted">{label}</span>
      <EditLines label={label} className="text-sm" value={t[key]} onChange={(v) => setTool(i, { [key]: v })} />
    </div>
  );
  return (
    <Section n={4} title="אפיון לכל מערכת">
      <div className="space-y-4">
        {p.tools.map((t, i) => {
          const st = stagesOf(t);
          return (
            <article key={i} className="avoid-break space-y-2 rounded-lg border border-line p-3">
              <h3 className="font-bold text-turq-ink">{i + 1}. {t.name || 'מערכת'}</h3>
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="lg:col-span-2">{field(t, i, 'whatItDoes', 'מה היא עושה')}</div>
                {field(t, i, 'input', 'מה נכנס')}
                {field(t, i, 'output', 'מה יוצא')}
                {field(t, i, 'users', 'מי משתמש')}
                {lines(t, i, 'screens', 'מסכים')}
                {lines(t, i, 'integrations', 'חיבורים')}
              </div>
              <div className="rounded-lg border border-orange bg-soft p-2">
                <span className="text-sm font-bold text-orange-ink">לא כלול</span>
                <EditLines label="לא כלול" className="text-sm" placeholder="מה לא כלול במערכת הזאת" value={t.notIncluded} onChange={(v) => setTool(i, { notIncluded: v })} />
              </div>
              <div className="text-sm">
                <p className="font-medium">הערכת זמן בנייה: <bdi>{totalHours(t)}</bdi> שעות <span className="text-xs font-normal text-muted">· לתכנון פנימי</span></p>
                {/* פירוט לפי שלב – לעריכה, לא מודפס */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted print:hidden">
                  {STAGES.map(([k, label]) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      {label}
                      <EditNum label={`${label} – ${t.name}`} value={st[k]} onChange={(v) => setTool(i, { buildHours: { ...st, [k]: v } })} />
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

export function TimelineSection({ p, set }) {
  const rows = p.timeline || [];
  const setRow = (i, patch) => set({ timeline: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <Section n={5} title="לוח זמנים">
      {rows.length === 0 && <p className="text-sm text-muted print:hidden">עוד אין לוח זמנים. אפשר להוסיף שלבים.</p>}
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <EditText label="שלב" className="min-w-0 flex-1 text-sm" value={r.stage} onChange={(v) => setRow(i, { stage: v })} />
            <EditText label="משך" className="w-28 shrink-0 text-sm" value={r.duration} onChange={(v) => setRow(i, { duration: v })} />
            <button className="rounded p-1.5 text-muted hover:text-danger print:hidden" aria-label="מחיקת שלב" onClick={() => set({ timeline: rows.filter((_, j) => j !== i) })}>
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {rows.length < 12 && (
        <button className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-turq-ink print:hidden" onClick={() => set({ timeline: [...rows, { stage: '', duration: '' }] })}>
          <Plus size={16} aria-hidden /> הוספת שלב
        </button>
      )}
    </Section>
  );
}
