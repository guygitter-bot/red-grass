// סעיפים 1-3: הבנת הלקוח, המערכות היום, מה לבנות
import { EditNum, EditText } from '../Editable';
import { Dots, EstimateTag, Section } from './parts';

export function UnderstandingSection({ p, set }) {
  return (
    <Section n={1} title="הבנת הלקוח">
      <EditText label="הבנת הלקוח" value={p.understanding} onChange={(v) => set({ understanding: v })} />
    </Section>
  );
}

// פסק דין על כל מערכת קיימת: להחליף / להשאיר / לחבר
export const VERDICT = {
  replace: { text: 'להחליף', cls: 'border-orange bg-soft text-orange-ink' },
  keep: { text: 'להשאיר', cls: 'border-line bg-page text-muted' },
  connect: { text: 'לחבר', cls: 'border-turq/50 bg-turq/15 text-turq-ink' },
};
const ORDER = ['replace', 'keep', 'connect'];

export function CurrentSystemsSection({ p, set }) {
  const rows = p.currentSystems;
  const setRow = (i, patch) => set({ currentSystems: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <Section n={2} title="המערכות היום">
      {rows.length === 0 && <p className="text-sm text-muted">לא נבדקו מערכות קיימות.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="avoid-break rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <EditText label="שם המערכת" className="min-w-0 flex-1 font-bold" value={r.name} onChange={(v) => setRow(i, { name: v })} />
              {/* לחיצה מחליפה פסק דין; בהדפסה רק התג הנבחר */}
              <button
                type="button"
                aria-label={`פסק דין: ${VERDICT[r.verdict].text} – לחצו להחלפה`}
                onClick={() => setRow(i, { verdict: ORDER[(ORDER.indexOf(r.verdict) + 1) % ORDER.length] })}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${VERDICT[r.verdict].cls} print:bg-transparent print:text-black`}
              >
                {VERDICT[r.verdict].text}
              </button>
            </div>
            <EditText label="הערה" className="text-sm" placeholder="למה?" value={r.note} onChange={(v) => setRow(i, { note: v })} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

const byValue = (a, b) => (b.t.benefit - b.t.effort) - (a.t.benefit - a.t.effort) || b.t.benefit - a.t.benefit;

// מערכות מדורגות לפי תועלת מול מאמץ; חיסכון בשעות מסומן "הערכה"
export function BuildSection({ p, setTool }) {
  const ranked = p.tools.map((t, i) => ({ t, i })).sort(byValue);
  return (
    <Section n={3} title="מה לבנות">
      {ranked.length === 0 && <p className="text-sm text-muted">אין מערכות בהמלצה.</p>}
      <ol className="space-y-3">
        {ranked.map(({ t, i }, rank) => (
          <li key={i} className="avoid-break rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-turq-ink">{rank + 1}.</span>
              <EditText label="שם המערכת" className="min-w-0 flex-1 font-bold" value={t.name} onChange={(v) => setTool(i, { name: v })} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 print:hidden">
              {[['replace', 'החלפה'], ['new', 'מערכת חדשה']].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={t.kind === k}
                  onClick={() => setTool(i, { kind: k })}
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${t.kind === k ? 'border-turq bg-turq/15 text-turq-ink' : 'border-line text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-turq/50 bg-turq/15 px-2.5 py-0.5 text-xs font-bold text-turq-ink print:bg-transparent print:text-black">
                {t.kind === 'replace' ? `החלפה של ${t.replaces || '…'}` : 'מערכת חדשה'}
              </span>
              {t.kind === 'replace' && (
                <EditText label="מה מחליפים" className="w-48 text-sm print:hidden" placeholder="איזו מערכת מוחלפת" value={t.replaces} onChange={(v) => setTool(i, { replaces: v })} />
              )}
              <Dots label="תועלת" value={t.benefit} />
              <Dots label="מאמץ" value={t.effort} />
            </div>
            <div className="mt-1 flex items-start gap-2">
              <span className="pt-1.5 text-sm font-medium">הכאב:</span>
              <EditText label="הכאב שהמערכת פותרת" className="flex-1 text-sm" value={t.problem} onChange={(v) => setTool(i, { problem: v })} />
            </div>
            <div className="mt-1 flex items-start gap-2">
              <span className="pt-1.5 text-sm font-medium">מה היא עושה:</span>
              <EditText label="מה המערכת עושה" className="flex-1 text-sm" value={t.whatItDoes} onChange={(v) => setTool(i, { whatItDoes: v })} />
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
