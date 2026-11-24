// סעיפים 7-8: תנאים בקצרה וצעד הבא אחד
import { termsOf } from '../../lib/pricing';
import { EditText } from '../Editable';
import { Section } from './parts';

export function TermsSection({ settings, p, set }) {
  return (
    <Section n={7} title="תנאים בקצרה">
      <ul className="list-disc space-y-1 ps-5 text-sm">
        {termsOf(settings).map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      <EditText label="הערות" className="mt-2 text-sm" placeholder="הערות נוספות (לא חובה)" value={p.notes} onChange={(v) => set({ notes: v })} />
    </Section>
  );
}

export function NextStepSection({ p, set }) {
  return (
    <Section n={8} title="צעד הבא">
      <EditText label="צעד הבא" className="font-medium" placeholder="צעד אחד ברור" value={p.nextStep} onChange={(v) => set({ nextStep: v })} />
    </Section>
  );
}
