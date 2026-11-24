// סעיף 6: צעד הבא אחד, והערות
import { EditText } from '../Editable';
import { Section } from './parts';

export function NextStepSection({ p, set }) {
  return (
    <Section n={6} title="צעד הבא">
      <EditText label="צעד הבא" className="font-medium" placeholder="צעד אחד ברור" value={p.nextStep} onChange={(v) => set({ nextStep: v })} />
      <EditText label="הערות" className="mt-2 text-sm" placeholder="הערות נוספות (לא חובה)" value={p.notes} onChange={(v) => set({ notes: v })} />
    </Section>
  );
}
