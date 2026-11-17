// כרטיס של סקיל חדש שבוט הציע: מחכה לאישור; אחרי האישור הבוט ממשיך לעבוד לפיו
import { useState } from 'react';
import { BadgeCheck, ExternalLink, Star } from 'lucide-react';
import { api } from '../lib/api';
import { RELOAD } from './Gen';
import { Button } from './ui';

// מקור הסקיל: מאגר, כוכבים, רשמי, עדכון אחרון, רישיון
export function Origin({ origin }) {
  if (!origin) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
      <a href={origin.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex items-center gap-1 text-accent-ink underline">
        {origin.repo} <ExternalLink size={11} />
      </a>
      {origin.official && (
        <span className="inline-flex items-center gap-0.5 text-ok">
          <BadgeCheck size={13} /> רשמי
        </span>
      )}
      <span className="num inline-flex items-center gap-0.5">
        <Star size={12} /> {Number(origin.stars || 0).toLocaleString('he-IL')}
      </span>
      {origin.updated && <span>עודכן {origin.updated.split('-').reverse().join('/')}</span>}
      <span>{origin.license || 'בלי רישיון'}</span>
    </div>
  );
}

export function SkillCard({ skill }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { name: skill.name });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };

  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm">
      <div className="font-medium break-words">🧩 {skill.title || skill.name}</div>
      {skill.when && <div className="text-xs text-muted break-words">{skill.when}</div>}
      <div className="mt-1">
        <Origin origin={skill.origin} />
      </div>
      {skill.status === 'pending' && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">
            {skill.update ? 'עדכון לסקיל קיים – הגרסה הנוכחית ממשיכה לעבוד עד שתאשר.' : 'הבוט לא מתחיל לעבוד עד שתאשר.'} אחרי האישור הוא ממשיך לבד. אפשר לקרוא את הסקיל בהגדרות ← "מה הצוות למד".
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/skills/approve')}>
              לאשר את הסקיל
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/skills/decline')}>
              לא צריך
            </Button>
          </div>
        </div>
      )}
      {skill.status === 'approved' && <div className="mt-2 text-ok">אושר – הבוט עובד לפיו</div>}
      {skill.status === 'removed' && <div className="mt-2 text-muted">לא אושר</div>}
      {error && <div className="mt-2 text-bad">{error}</div>}
    </div>
  );
}
