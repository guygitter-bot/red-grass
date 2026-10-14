import { useEffect, useRef, useState } from 'react';
import { chime } from '../lib/sound';
import { Avatar, Button, Card } from './ui';

// לפני כל סיבוב: כולם מאשרים "אני מוכן/ה". מי שלא אישר תוך חצי דקה – המשחק מתחיל בלעדיו
export default function Ready({ state, act, now }) {
  const ready = state.ready || { until: 0, players: [] };
  const [t, setT] = useState(now);
  const [busy, setBusy] = useState(false);
  const iAmReady = ready.players.includes(state.me);
  const rang = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setT(now()), 250);
    return () => {
      clearInterval(id);
    };
  }, [now]);

  // צלצול למי שעוד לא אישר – שישים לב שמתחילים
  useEffect(() => {
    if (!iAmReady && !rang.current) {
      rang.current = true;
      chime();
    }
  }, [iAmReady]);

  const left = Math.max(0, Math.ceil((ready.until - t) / 1000));
  const confirm = async () => {
    setBusy(true);
    await act('/ready').catch(() => {});
    setBusy(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-4">
      <Card className="flex flex-col items-center gap-3 text-center">
        <div className="text-lg font-bold">{state.round ? `סיבוב ${state.round.n + 1}` : 'הסיבוב הראשון'} מתחיל!</div>
        <div className="text-6xl font-extrabold tabular-nums text-accent-ink">{left}</div>
        <div className="text-muted">
          {iAmReady ? 'מחכים שכולם יאשרו... המשחק יתחיל אוטומטית כשהזמן ייגמר' : 'מוכנים? לחצו כדי להתחיל'}
        </div>
        {!iAmReady && (
          <Button className="w-full py-4 text-xl" onClick={confirm} disabled={busy}>
            ✋ אני מוכן/ה!
          </Button>
        )}
      </Card>
      <Card>
        <div className="mb-3 font-bold">
          מי מוכן ({ready.players.length}/{state.players.length})
        </div>
        <ul className="flex flex-col gap-2">
          {state.players.map((p) => {
            const ok = ready.players.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar player={p} size={40} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className={ok ? 'font-medium text-accent-ink' : 'text-muted'}>{ok ? '✓ מוכן/ה' : '⏳ עוד לא'}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
