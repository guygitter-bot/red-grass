// התפריט הקבוע: ארוחות שחוזרות (שם, שעה, מה אוכלים, מנה רגילה, באילו ימים). לכל ארוחה – הדפוס שלה:
// כמה אינסולין ניתן בדרך כלל, מה יצא שעתיים אחרי, ומה עבד הכי טוב.
import { useState } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { DAYS, SLOTS, numOrEmpty, pattern, safeTemplate } from '../lib/diary';
import { newId, save } from '../lib/store';
import { Button, Field, Sheet, inputCls } from './ui';
import { Glucose } from './bits';

function TemplateEditor({ tpl, onClose }) {
  const [t, setT] = useState({ ...safeTemplate(tpl), name: tpl.name || '', carbs: String(numOrEmpty(tpl.carbs)), dose: String(numOrEmpty(tpl.dose)), portion: String(safeTemplate(tpl).portion) });
  const set = (patch) => setT((x) => ({ ...x, ...patch }));
  const submit = (e) => {
    e.preventDefault();
    save({ ...t, id: tpl.id || newId('t'), t: 'template', portion: numOrEmpty(t.portion) || 1, carbs: numOrEmpty(t.carbs), dose: numOrEmpty(t.dose) });
    onClose();
  };
  return (
    <Sheet title={tpl.id ? 'עריכת ארוחה קבועה' : 'ארוחה קבועה חדשה'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="שם">
            <input className={inputCls} value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="למשל: צהריים בגן" required autoFocus />
          </Field>
          <Field label="שעה רגילה">
            <input type="time" className={`${inputCls} num`} value={t.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(SLOTS).map(([k, label]) => (
            <button key={k} type="button" onClick={() => set({ slot: k })} className={`rounded-full border px-3 py-1 text-sm ${t.slot === k ? 'border-accent bg-soft text-accent-ink' : 'border-line text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        <Field label="מה אוכלים">
          <textarea className={inputCls} rows={2} value={t.food} onChange={(e) => set({ food: e.target.value })} placeholder="למשל: 2 פרוסות לחם, גבינה, ירקות" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="מנה רגילה">
            <input className={`${inputCls} num`} inputMode="decimal" value={t.portion} onChange={(e) => set({ portion: e.target.value })} />
          </Field>
          <Field label="פחמימה (גרם)">
            <input className={`${inputCls} num`} inputMode="numeric" value={t.carbs} onChange={(e) => set({ carbs: e.target.value })} placeholder="לא חובה" />
          </Field>
          <Field label="אינסולין רגיל">
            <input className={`${inputCls} num`} inputMode="decimal" value={t.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="יחידות" />
          </Field>
        </div>
        <Field label="באילו ימים" hint="בלי סימון = כל יום">
          <div className="flex gap-1">
            {DAYS.map((d, i) => {
              const on = t.days.includes(i);
              return (
                <button key={i} type="button" onClick={() => set({ days: on ? t.days.filter((x) => x !== i) : [...t.days, i].sort() })} className={`flex-1 rounded-lg border py-2 text-sm ${on ? 'border-accent bg-soft font-bold text-accent-ink' : 'border-line text-muted'}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex gap-2">
          <Button className="flex-1">שמירה</Button>
          {tpl.id && (
            <Button
              type="button"
              kind="ghost"
              onClick={() => {
                save({ id: tpl.id, archived: !t.archived });
                onClose();
              }}
            >
              {t.archived ? 'להחזיר לתפריט' : 'להוריד מהתפריט'}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">הורדה מהתפריט לא מוחקת ארוחות שכבר נרשמו.</p>
      </form>
    </Sheet>
  );
}

function TemplateCard({ t, data, onEdit }) {
  const s = data.settings;
  const list = data.meals.filter((m) => m.templateId === t.id).slice(-20);
  const p = pattern(data, list);
  return (
    <article className={`rounded-2xl bg-card p-4 shadow-sm ${t.archived ? 'opacity-60' : ''}`}>
      <div className="mb-2 flex items-start gap-2">
        <span className="num rounded-lg bg-soft px-2 py-0.5 text-sm font-bold text-accent-ink">{t.time}</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {t.name} <span className="text-sm font-normal text-muted">· {SLOTS[t.slot]}</span>
          </div>
          {t.food && <div className="text-sm text-muted">{t.food}</div>}
          <div className="mt-1 text-xs text-muted">
            {t.days.length ? t.days.map((d) => DAYS[d]).join(' ') : 'כל יום'} · מנה {t.portion}
            {t.carbs !== '' && ` · ${t.carbs} גר׳ פחמ׳`}
            {t.dose !== '' && ` · בדרך כלל ${t.dose} יח׳`}
            {t.archived && ' · לא בתפריט'}
          </div>
        </div>
        <button onClick={onEdit} className="rounded-full p-2 text-muted hover:bg-soft" aria-label="עריכה">
          {t.archived ? <Archive size={18} /> : <Pencil size={18} />}
        </button>
      </div>
      {p.count > 0 ? (
        <div className="rounded-xl bg-page p-3 text-sm">
          <div className="mb-1 font-medium">ב-{p.count} הפעמים האחרונות</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              אינסולין ממוצע <b className="num">{p.dose === '' ? '—' : p.dose}</b>
              {p.dosePerPortion !== '' && <span className="num text-muted"> ({p.dosePerPortion} למנה)</span>}
            </span>
            {p.before !== '' && (
              <span className="flex items-center gap-1">
                לפני <Glucose value={p.before} settings={s} small before />
              </span>
            )}
            {p.after2h !== '' && (
              <span className="flex items-center gap-1">
                שעתיים אחרי <Glucose value={p.after2h} settings={s} small />
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted">
            {p.measured ? `נמדד שעתיים אחרי ב-${p.measured} מהן, ${p.inRange} בטווח` : 'עוד אין מדידות שעתיים אחרי'}
            {p.lows > 0 && <span className="text-low"> · {p.lows} פעמים ירד מתחת ל-{s.low}</span>}
          </div>
          {p.good.length > 0 && (
            <div className="mt-1 text-xs">
              ✅ מה שעבד: {p.good.slice(-3).map((m) => `${m.portion} מנות + ${m.insulin} יח׳ (לפני ${m.before === '' ? '?' : m.before})`).join(' · ')}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">עוד לא נרשמה – אחרי כמה פעמים יופיע כאן מה עובד.</p>
      )}
    </article>
  );
}

export default function MenuView({ data }) {
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = data.templates.filter((t) => showArchived || !t.archived);
  const archived = data.templates.filter((t) => t.archived).length;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">תפריט קבוע</h1>
        <Button onClick={() => setEditing({ t: 'template', name: '', slot: 'lunch' })} className="flex items-center gap-1">
          <Plus size={18} /> ארוחה קבועה
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted">ארוחות שחוזרות. במסך היום מוסיפים אותן בלחיצה, ורק ממלאים סוכר, אינסולין ומדידות. כאן רואים מה עבד בכל ארוחה.</p>
      {!list.length && <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted shadow-sm">עוד אין ארוחות קבועות. למשל: "ארוחת בוקר", "עשר בגן", "צהריים אצל סבתא".</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((t) => (
          <TemplateCard key={t.id} t={t} data={data} onEdit={() => setEditing(t)} />
        ))}
      </div>
      {archived > 0 && (
        <button onClick={() => setShowArchived(!showArchived)} className="mt-4 text-sm text-muted underline">
          {showArchived ? 'להסתיר' : `להציג גם ארוחות שהורדו מהתפריט (${archived})`}
        </button>
      )}
      {editing && <TemplateEditor tpl={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
