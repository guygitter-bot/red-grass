import { useState } from 'react';
import { LENSES, lensById, lensQuestions } from '../lib/lenses';

// "לפרש דרך עדשה": שאלות להתבוננות מארבע תורות. הכול מקומי, בלי AI.
export default function LensSection({ entry, intention, settings, onSave }) {
  const [open, setOpen] = useState(null);
  const [answers, setAnswers] = useState([]);
  const lens = open ? lensById(open) : null;
  const questions = lens ? lensQuestions(lens.id, entry, settings, intention?.text) : [];
  const saved = entry.lensNotes || {};

  const choose = (id) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setAnswers(saved[id] ? [...saved[id]] : []);
  };
  const setAnswer = (i, v) => setAnswers((a) => {
    const n = [...a];
    while (n.length <= i) n.push('');
    n[i] = v;
    return n;
  });

  return (
    <section className="mt-8" aria-labelledby="lens-h">
      <h3 id="lens-h" className="font-bold m-0 mb-1">לפרש דרך עדשה</h3>
      <p className="text-sm text-muted mt-0 mb-3">
        כמה דרכים להתבונן בחלום, בשאלות ובלי תשובה מוכנה. זה לא פירוש "נכון" ולא חיזוי.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="בחירת עדשה">
        {LENSES.map((l) => (
          <button key={l.id} className="chip" aria-pressed={open === l.id} onClick={() => choose(l.id)}>
            <span aria-hidden="true">{l.icon}</span> {l.name}
            {saved[l.id] && <span className="text-accent" aria-label="יש תשובות שמורות"> ✓</span>}
          </button>
        ))}
      </div>

      {lens && (
        <div className="sheet p-4 mt-3 grid gap-4">
          <div>
            <p className="m-0">{lens.blurb}</p>
            <p className="text-sm text-muted mt-2 mb-0">{lens.basis}</p>
            {lens.id === 'hd' && !(settings.hd?.type || settings.hd?.authority) && (
              <p className="text-sm mt-2 mb-0">
                כדי לקבל שאלות מותאמות, אפשר לבחור סוג ותוקף ב<a href="#/settings" className="text-accent">הגדרות</a>.
              </p>
            )}
          </div>
          {questions.map((x, i) => (
            <label key={`${lens.id}-${i}`} className="block">
              <span className="block font-semibold">{x.q}</span>
              {x.hint && <span className="block text-sm text-muted mb-1">{x.hint}</span>}
              <textarea className="field serif" rows={3} value={answers[i] || ''} onChange={(ev) => setAnswer(i, ev.target.value)} />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(lens.id, questions.map((_, i) => answers[i] || ''));
                setOpen(null);
              }}
            >
              לשמור את התשובות
            </button>
            <a href="#/learn" className="text-sm text-accent">על התורות ומקורותיהן</a>
          </div>
        </div>
      )}

      {LENSES.some((l) => saved[l.id]) && (
        <div className="grid gap-3 mt-4">
          {LENSES.filter((l) => saved[l.id]).map((l) => {
            const qs = lensQuestions(l.id, entry, settings, intention?.text);
            return (
              <div key={l.id} className="sheet bg-soft p-4">
                <h4 className="font-bold m-0 mb-2"><span aria-hidden="true">{l.icon}</span> {l.name}</h4>
                <dl className="m-0 grid gap-3">
                  {saved[l.id].map((a, i) => a.trim() && (
                    <div key={i}>
                      <dt className="text-sm text-muted">{qs[i]?.q || 'שאלה'}</dt>
                      <dd className="m-0 serif whitespace-pre-wrap">{a}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
