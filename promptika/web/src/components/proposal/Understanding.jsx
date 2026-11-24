// סעיפים 1-4: הבנת הלקוח, המלצה, אפיון לכל כלי, לוח זמנים
import { Plus, X } from 'lucide-react';
import { EditLines, EditNum, EditText } from '../Editable';
import { EstimateTag, Section } from './parts';

export function UnderstandingSection({ p, set }) {
  return (
    <Section n={1} title="הבנת הלקוח">
      <EditText label="הבנת הלקוח" value={p.understanding} onChange={(v) => set({ understanding: v })} />
    </Section>
  );
}

// כלים מדורגים לפי תועלת מול מאמץ; כאב וחיסכון מסומנים "הערכה"
export function RecommendSection({ p, setTool }) {
  return (
    <Section n={2} title="המלצה">
      {p.tools.length === 0 && <p className="text-sm text-muted">אין כלים בהצעה.</p>}
      <ol className="space-y-3">
        {p.tools.map((t, i) => (
          <li key={i} className="avoid-break rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-turq-ink">{i + 1}.</span>
              <EditText label="שם הכלי" className="min-w-0 flex-1 font-bold" value={t.name} onChange={(v) => setTool(i, { name: v })} />
              <span className="text-xs text-muted">תועלת <bdi>{t.benefit}/5</bdi> · מאמץ <bdi>{t.effort}/5</bdi></span>
            </div>
            <div className="mt-1 flex items-start gap-2">
              <span className="pt-1.5 text-sm font-medium">הכאב:</span>
              <EditText label="הכאב שהכלי פותר" className="flex-1 text-sm" value={t.problem} onChange={(v) => setTool(i, { problem: v })} />
              <span className="pt-1"><EstimateTag /></span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">חיסכון משוער:</span>
              <EditNum label="שעות חיסכון בחודש" value={t.savedHoursPerMonth} onChange={(v) => setTool(i, { savedHoursPerMonth: v })} />
              <span>שעות בחודש</span>
              <EstimateTag />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

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
    <Section n={3} title="אפיון לכל כלי">
      <div className="space-y-4">
        {p.tools.map((t, i) => (
          <article key={i} className="avoid-break space-y-2 rounded-lg border border-line p-3">
            <h3 className="font-bold text-turq-ink">{i + 1}. {t.name || 'כלי'}</h3>
            <div className="grid gap-2 lg:grid-cols-2">
              {field(t, i, 'input', 'מה נכנס')}
              {field(t, i, 'output', 'מה יוצא')}
              {field(t, i, 'users', 'מי משתמש')}
              {lines(t, i, 'screens', 'מסכים')}
              {lines(t, i, 'integrations', 'חיבורים')}
            </div>
            <div className="rounded-lg border border-orange bg-soft p-2">
              <span className="text-sm font-bold text-orange-ink">לא כלול</span>
              <EditLines label="לא כלול" className="text-sm" placeholder="מה לא כלול בכלי הזה" value={t.notIncluded} onChange={(v) => setTool(i, { notIncluded: v })} />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function TimelineSection({ p, set }) {
  const rows = p.timeline || [];
  const setRow = (i, patch) => set({ timeline: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <Section n={4} title="לוח זמנים">
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
