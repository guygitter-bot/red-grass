// "מה הצוות למד": סקילים שהספרן 📚 לימד את הבוטים ממאגר AI. אפשר לפתוח, לקרוא ולמחוק
import { useEffect, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { findAgent } from '../lib/agents';
import Markdown from './Markdown';
import { Origin } from './SkillCard';
import { Button } from './ui';

export default function Skills({ agents, connected }) {
  const [skills, setSkills] = useState(null);
  const [open, setOpen] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/app/skills', {})
      .then((r) => setSkills(r.skills || []))
      .catch((e) => setError(e.message));
  }, []);

  // סקיל מ-GitHub שמחכה לאישור
  const approve = async (skill) => {
    try {
      const r = await api('/app/skills/approve', { name: skill.name });
      setSkills(r.skills || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (skill) => {
    if (!window.confirm(`למחוק את "${skill.title}"? הבוטים לא ישתמשו בזה יותר.`)) return;
    try {
      const r = await api('/app/skills/delete', { name: skill.name });
      setSkills(r.skills || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 font-bold">מה הצוות למד</h2>
      <p className="mb-3 text-sm text-muted">
        שיטות ופרומפטים שהבוטים למדו – ממאגר AI, מהרשת או מ-GitHub. כדי להוסיף: לבקש בשיחה, למשל "תלמד את העורך כל מה שיש במאגר על עריכת רילס" או "תחפש ב-GitHub סקיל לתכנון טיולים". מה שנלמד מ-GitHub מחכה לאישור שלך.
      </p>
      {connected === false && <p className="mb-3 text-sm text-bad">מאגר AI עוד לא מחובר.</p>}
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      {skills?.length === 0 && <p className="text-sm text-muted">עוד לא נלמד כלום.</p>}
      <ul className="space-y-2">
        {skills?.map((s) => (
          <li key={s.name} className="rounded-xl bg-soft">
            <div className="flex items-start gap-2 px-3 py-2">
              <button className="flex min-w-0 flex-1 items-start gap-2 text-start" onClick={() => setOpen(open === s.name ? '' : s.name)} aria-expanded={open === s.name}>
                <ChevronDown size={16} className={`mt-1 shrink-0 text-muted transition-transform ${open === s.name ? 'rotate-180' : ''}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">
                    {s.title}
                    {s.pending && <span className="ms-1.5 rounded-full bg-card px-2 py-0.5 text-xs font-medium text-accent-ink">מחכה לאישור</span>}
                  </span>
                  <span className="block text-sm text-muted break-words">{s.when}</span>
                  <span className="mt-1 flex flex-wrap gap-1 text-xs">
                    {(s.agents || []).map((k) => {
                      const a = findAgent(agents, k);
                      return (
                        <span key={k} className="rounded-full border border-line bg-card px-2 py-0.5">
                          {a ? `${a.emoji} ${a.name}` : k}
                        </span>
                      );
                    })}
                  </span>
                </span>
              </button>
              <button onClick={() => remove(s)} className="p-1 text-muted hover:text-bad" aria-label="מחיקה">
                <Trash2 size={16} />
              </button>
            </div>
            {open === s.name && (
              <div className="border-t border-line px-3 py-3 text-sm">
                {s.origin ? (
                  <div className="mb-2">
                    <Origin origin={s.origin} />
                  </div>
                ) : (
                  s.source && <p className="mb-2 text-xs text-muted">מקור: {s.source}</p>
                )}
                {s.pending && (
                  <Button className="mb-3" onClick={() => approve(s)}>
                    לאשר את הסקיל
                  </Button>
                )}
                <Markdown text={s.body} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
