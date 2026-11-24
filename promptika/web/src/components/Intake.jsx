// טופס קליטה בכרטיס הלקוח: 9 חלקים מתקפלים, שמירה אוטומטית
import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { INTAKE_SECTIONS } from '../data/intakeSections';
import { addRow, removeRow, sectionStatus, setField, setRowField } from '../lib/intake';
import { useIntakeSave } from '../lib/useIntakeSave';
import { Button, Card, inputClass } from './ui';
import { IntakeField, RowCard, StatusChip } from './IntakeParts';

const SAVE_TEXT = {
  idle: 'נשמר אוטומטית',
  dirty: 'ממתין לשמירה…',
  saving: 'שומר…',
  saved: 'נשמר ✓',
  error: 'לא נשמר – מנסה שוב',
};

// שדות קבועים בתוך חלק (בטלפון בעמודה, במחשב בשתי עמודות)
function FieldsBody({ section, intake, change }) {
  const data = intake[section.key];
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {section.fields
        .filter((f) => !f.showIf || data[f.showIf.key] === f.showIf.value)
        .map((f) => (
          <IntakeField key={f.key} def={f} idPrefix={section.id} value={data[f.key]} onChange={(v) => change((i) => setField(i, section.key, f.key, v))} />
        ))}
    </div>
  );
}

// שורות חוזרות (כלים קיימים, כאבים)
function RowsBody({ section, intake, change }) {
  const list = intake[section.key];
  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-muted">{section.empty}</p>}
      {list.map((row, n) => (
        <RowCard key={n} title={`${section.rowLabel} ${n + 1}`} onRemove={() => change((i) => removeRow(i, section.key, n))}>
          <div className="grid gap-3 lg:grid-cols-2">
            {section.fields.map((f) => (
              <IntakeField
                key={f.key}
                def={f}
                idPrefix={`${section.id}-${n}`}
                value={row[f.key]}
                onChange={(v) => change((i) => setRowField(i, section.key, n, f.key, v))}
              />
            ))}
          </div>
        </RowCard>
      ))}
      <AddButton section={section} intake={intake} change={change} />
    </div>
  );
}

// רשימת שורות טקסט (כלים חסרים)
function ListBody({ section, intake, change }) {
  const list = intake[section.key];
  return (
    <div className="space-y-2">
      {list.length === 0 && <p className="text-sm text-muted">{section.empty}</p>}
      {list.map((text, n) => (
        <RowCard key={n} title={`${section.rowLabel} ${n + 1}`} onRemove={() => change((i) => removeRow(i, section.key, n))}>
          <input
            aria-label={`${section.rowLabel} ${n + 1}`}
            className={inputClass}
            value={text}
            placeholder={section.placeholder}
            onChange={(e) => change((i) => setRowField(i, section.key, n, null, e.target.value))}
          />
        </RowCard>
      ))}
      <AddButton section={section} intake={intake} change={change} />
    </div>
  );
}

function AddButton({ section, intake, change }) {
  return (
    <Button type="button" kind="ghost" onClick={() => change((i) => addRow(i, section.key))} disabled={intake[section.key].length >= 30}>
      <Plus size={16} aria-hidden />
      {section.addLabel}
    </Button>
  );
}

const BODY = { fields: FieldsBody, rows: RowsBody, list: ListBody };

function Section({ section, intake, change, open, onToggle, number }) {
  const Body = BODY[section.kind];
  const status = sectionStatus(intake, section);
  return (
    <div className="rounded-lg border border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`intake-${section.id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-start"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night text-xs font-bold text-white">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">{section.title}</span>
          {!open && <span className="block truncate text-xs text-muted">{section.hint}</span>}
        </span>
        <StatusChip status={status} />
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={`intake-${section.id}`} className="border-t border-line p-3 lg:p-4">
          <p className="mb-3 text-sm text-muted">{section.hint}</p>
          <Body section={section} intake={intake} change={change} />
        </div>
      )}
    </div>
  );
}

export default function Intake({ clientId, serverIntake, serverUpdatedAt }) {
  const { intake, change, status } = useIntakeSave(clientId, serverIntake, serverUpdatedAt);
  const [openIds, setOpenIds] = useState(['business']);
  const toggle = (id) => setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const filled = INTAKE_SECTIONS.filter((s) => sectionStatus(intake, s) === 'filled').length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold">טופס קליטה</h2>
        <span className="text-sm text-muted">{filled} מתוך {INTAKE_SECTIONS.length} חלקים מלאים</span>
        <span role="status" aria-live="polite" className={`ms-auto text-sm font-medium ${status === 'error' ? 'text-danger' : 'text-muted'}`}>
          {SAVE_TEXT[status]}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted">אפשר לדלג על כל שדה ולחזור אליו אחר כך. הכול נשמר לבד.</p>
      <div className="space-y-2">
        {INTAKE_SECTIONS.map((s, n) => (
          <Section key={s.id} section={s} number={n + 1} intake={intake} change={change} open={openIds.includes(s.id)} onToggle={() => toggle(s.id)} />
        ))}
      </div>
    </Card>
  );
}
