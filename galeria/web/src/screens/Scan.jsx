import { count } from '../lib/format.js';

export default function Scan({ done, total, stage }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  // בערך 15 תמונות בשנייה בטלפון ממוצע
  const left = total ? Math.ceil((total - done) / 15 / 60) : 0;
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full bg-card border border-line rounded-3xl p-6 text-center flex flex-col gap-4">
        <div className="text-5xl" aria-hidden>
          🔎
        </div>
        <h1 className="text-xl font-bold">{stage === 'list' ? 'קוראים את רשימת התמונות...' : 'עוברים על התמונות'}</h1>
        {stage !== 'list' && (
          <>
            <div className="h-3 rounded-full bg-soft overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-muted">
              {count(done)} מתוך {count(total)} ({pct}%)
              {left > 1 && ` · עוד כ־${left} דקות`}
            </p>
          </>
        )}
        <p className="text-sm text-muted">
          בפעם הראשונה זה לוקח כמה דקות. בפעמים הבאות – רק תמונות חדשות נבדקות. כדאי להשאיר את המסך פתוח.
        </p>
      </div>
    </div>
  );
}
