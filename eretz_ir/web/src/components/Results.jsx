import { useState } from 'react';
import { recentLetters } from '../lib/profile';
import { Avatar, Button, Card, TimePicker } from './ui';

const REASONS = { letter: 'לא מתחיל באות', short: 'רק אות אחת', wrong: 'לא מתאים ל', voted: 'נפסל', empty: '' };

function Points({ cell }) {
  if (!cell.valid) return <span className="w-10 shrink-0 text-center text-sm text-muted">0</span>;
  const look = cell.points === 10 ? 'bg-accent text-white' : 'bg-gold text-white';
  return <span className={`w-10 shrink-0 rounded-full py-0.5 text-center text-sm font-bold ${look}`}>{cell.points}</span>;
}

// הניקוד הכולל, מהגבוה לנמוך
export function Scoreboard({ state, roundTotals }) {
  const players = [...state.players].sort((a, b) => b.total - a.total);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Card>
      <div className="mb-3 font-bold">הניקוד</div>
      <ol className="flex flex-col gap-2">
        {players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-2xl px-2 py-1 ${p.id === state.me ? 'bg-soft' : ''}`}>
            <span className="w-6 text-center">{p.total > 0 && medals[i] ? medals[i] : i + 1}</span>
            <Avatar player={p} size={36} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {roundTotals && <span className="text-sm text-accent-ink">+{roundTotals[p.id] || 0}</span>}
            <span className="w-12 text-left text-xl font-bold tabular-nums">{p.total}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// סוף סיבוב: התשובות של כולם לפי קטגוריה. אפשר לסמן 👎 על תשובה של מישהו אחר שלא נכונה
export default function Results({ state, act }) {
  const { round, results } = state;
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(state.seconds);
  const others = state.players.length - 1;

  const vote = (category, target, bad) => act('/vote', { round: round.n, category, target, bad }).catch(() => {});
  const approve = (category, target, yes) => act('/vote', { round: round.n, category, target, kind: 'approve', approve: yes }).catch(() => {});
  const next = async () => {
    setBusy(true);
    await act('/start', { seconds, recent: recentLetters() }).catch(() => {});
    setBusy(false);
  };

  // בודקים ומתקנים שגיאות כתיב (עד חצי דקה) – התוצאות אחר כך
  if (round.spell === 'pending') {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <div className="animate-bounce text-6xl">✏️</div>
          <div className="mt-3 text-xl font-bold">הזמן נגמר!</div>
          <div className="mt-1 text-muted">בודקים את התשובות ומתקנים שגיאות כתיב...</div>
          <div className="mt-1 text-sm text-muted">תשובה שנראית לא נכונה נבדקת פעמיים, לפעמים גם בחיפוש ברשת</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-4xl font-extrabold text-white">{round.letter}</div>
        <div>
          <h2 className="text-2xl font-bold">סוף סיבוב {round.n}</h2>
          <p className="text-sm text-muted">10 – תשובה שרק אחד כתב · 5 – תשובה שכמה כתבו</p>
          {results.bonus && (
            <p className="mt-1 text-sm font-medium text-gold">
              🏁 {state.players.find((p) => p.id === results.bonus.id)?.name} סיים/ה ראשון/ה – בונוס +{results.bonus.points}
            </p>
          )}
          {round.spell === 'failed' && <p className="text-sm text-muted">(הפעם לא הצלחנו לבדוק את התשובות)</p>}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="lg:sticky lg:top-4 lg:order-last">
          <Scoreboard state={state} roundTotals={results.totals} />
          {others > 0 && (
            <p className="mt-2 px-2 text-sm leading-relaxed text-muted">
              תשובה לא נכונה? לוחצים 👎. המערכת פסלה תשובה נכונה? לוחצים 👍. ההחלטה לפי יותר ממחצית השחקנים האחרים.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {state.categories.map((c) => {
            const cells = results.rows[c.id] || {};
            return (
              <Card key={c.id} className="p-3">
                <div className="mb-2 font-bold text-accent-ink">{c.label}</div>
                <ul className="flex flex-col gap-2">
                  {state.players.map((p) => {
                    const cell = cells[p.id];
                    if (!cell) return null;
                    const mine = cell.voters.includes(state.me);
                    const approvers = cell.approvers || [];
                    const approved = approvers.includes(state.me);
                    // תשובה שהמערכת פסלה (או שאושרה) – 👍. תשובה תקינה – 👎
                    const canApprove = p.id !== state.me && (cell.reason === 'wrong' || approvers.length > 0);
                    const canVote = p.id !== state.me && cell.text && !canApprove && !['letter', 'short'].includes(cell.reason);
                    return (
                      <li key={p.id} className="flex items-center gap-2">
                        <Avatar player={p} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className={`truncate ${cell.valid ? '' : 'text-muted line-through decoration-red-400'} ${cell.text ? '' : 'no-underline'}`}>
                            {cell.text || '—'}
                          </div>
                          {cell.typed && <div className="truncate text-sm text-muted">✏️ תוקן מ"{cell.typed}"</div>}
                          {(REASONS[cell.reason] || cell.voters.length > 0 || approvers.length > 0) && (
                            <div className="text-sm text-muted">
                              {REASONS[cell.reason]}
                              {cell.reason === 'letter' && ` ${round.letter}`}
                              {cell.reason === 'wrong' && c.label}
                              {cell.reason === 'wrong' && cell.why && ` – ${cell.why}`}
                              {cell.voters.length > 0 && cell.reason !== 'letter' && ` 👎 ${cell.voters.length}`}
                              {approvers.length > 0 && ` 👍 ${approvers.length}`}
                            </div>
                          )}
                        </div>
                        {canVote && (
                          <button
                            type="button"
                            onClick={() => vote(c.id, p.id, !mine)}
                            title={mine ? 'ביטול הפסילה' : 'לא נכון'}
                            aria-label={mine ? 'ביטול הפסילה' : 'לא נכון'}
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm transition ${mine ? 'border-red-400 bg-red-100 dark:bg-red-950' : 'border-line opacity-60 hover:opacity-100'}`}
                          >
                            👎
                          </button>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => approve(c.id, p.id, !approved)}
                            title={approved ? 'ביטול האישור' : 'זה כן נכון'}
                            aria-label={approved ? 'ביטול האישור' : 'זה כן נכון'}
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm transition ${approved ? 'border-accent bg-soft' : 'border-line opacity-60 hover:opacity-100'}`}
                          >
                            👍
                          </button>
                        )}
                        <Points cell={cell} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 lg:flex-row lg:items-center">
          <TimePicker value={seconds} onChange={setSeconds} />
          <Button className="text-lg lg:mr-auto lg:px-10" onClick={next} disabled={busy}>
            🔁 סיבוב נוסף
          </Button>
        </div>
      </div>
    </div>
  );
}
