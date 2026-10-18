import { useState } from 'react';
import { COUNTS, ERAS, LANGS, MODES, TEAMS, inviteLink } from '../lib/game';
import { unlockAudio } from '../lib/audio';
import { Avatar, Button, Card, Chips } from './ui';

const INVITE_TEXT = 'בואו לשחק איתי "מה השיר?" – מי מזהה ראשון? 🎵';

// הזמנת חברים: שיתוף (בטלפון), וואטסאפ, או העתקת הקישור
export function Invite({ code }) {
  const [copied, setCopied] = useState(false);
  const url = inviteLink(code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('להעתיק את הקישור:', url);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'מה השיר?', text: INVITE_TEXT, url });
    } catch (e) {
      if (e.name !== 'AbortError') copy();
    }
  };
  return (
    <Card className="text-center">
      <div className="text-sm text-muted">קוד המשחק</div>
      <div dir="ltr" className="my-1 text-4xl font-extrabold tracking-[0.3em] text-accent-ink">
        {code}
      </div>
      <p className="mb-3 text-sm text-muted">שולחים לחברים את הקישור – מי שלוחץ עליו מצטרף למשחק</p>
      <div className="flex flex-wrap justify-center gap-2">
        {navigator.share && <Button onClick={share}>📤 שיתוף</Button>}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT}\n${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-[#25d366] px-4 py-3 font-medium text-white shadow-sm hover:brightness-110"
        >
          וואטסאפ
        </a>
        <Button kind="secondary" onClick={copy}>
          {copied ? '✓ הועתק' : '🔗 העתקת קישור'}
        </Button>
      </div>
    </Card>
  );
}

function PlayerRow({ p, state }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar player={p} size={40} />
      <span className="min-w-0 truncate text-lg">{p.name}</span>
      {p.id === state.me && <span className="text-sm text-muted">(את/ה)</span>}
      {p.id === state.hostId && <span className="mr-auto text-sm" title="פתח/ה את המשחק">👑</span>}
    </li>
  );
}

// מי כבר כאן – רשימה אחת, או שתי קבוצות (עם מעבר בין הקבוצות)
export function Players({ state, act }) {
  const teams = state.settings.mode === 'teams';
  const mine = state.players.find((p) => p.id === state.me);
  if (!teams) {
    return (
      <Card>
        <div className="mb-3 font-bold">מי כבר כאן ({state.players.length})</div>
        <ul className="flex flex-col gap-2">
          {state.players.map((p) => (
            <PlayerRow key={p.id} p={p} state={state} />
          ))}
        </ul>
        {state.players.length < 2 && <p className="mt-3 text-sm text-muted">מחכים לחברים... (אפשר גם לשחק לבד, לאימון)</p>}
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-bold">הקבוצות</span>
        {state.me === state.hostId && (
          <Button kind="ghost" className="mr-auto px-3 py-1.5 text-sm" onClick={() => act('/team', { shuffle: true }).catch(() => {})}>
            🔀 ערבוב
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {TEAMS.map((t, i) => {
          const members = state.players.filter((p) => p.team === i);
          return (
            <div key={t.name} className="rounded-2xl border border-line bg-page p-3">
              <div className={`mb-2 font-bold ${t.color}`}>
                {t.icon} {t.name} ({members.length})
              </div>
              <ul className="flex flex-col gap-2">
                {members.map((p) => (
                  <PlayerRow key={p.id} p={p} state={state} />
                ))}
              </ul>
              {mine && mine.team !== i && (
                <Button kind="secondary" className="mt-3 w-full px-2 py-2 text-sm" onClick={() => act('/team', { team: i }).catch(() => {})}>
                  לעבור {t.to}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ההגדרות: מי שפתח את המשחק בוחר, כל השאר רואים
export function Settings({ state, act }) {
  const host = state.me === state.hostId;
  const s = state.settings;
  const set = (change) => act('/settings', { settings: { ...s, ...change } }).catch(() => {});
  return (
    <Card className="flex flex-col gap-4 text-center">
      {!host && <div className="text-sm text-muted">את ההגדרות קובע/ת מי שפתח/ה את המשחק 👑</div>}
      <div className="flex flex-col gap-2">
        <div className="font-bold">איך משחקים?</div>
        <Chips options={MODES} value={s.mode} readOnly={!host} onChange={(mode) => set({ mode })} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-bold">איזה שירים?</div>
        <Chips options={LANGS} value={s.lang} readOnly={!host} onChange={(lang) => set({ lang })} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-bold">מאיזה שנים?</div>
        <Chips options={ERAS} value={s.era} readOnly={!host} onChange={(era) => set({ era })} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-bold">כמה שאלות?</div>
        <Chips options={COUNTS.map((n) => ({ id: n, label: `${n} שאלות` }))} value={s.count} readOnly={!host} onChange={(count) => set({ count })} />
      </div>
    </Card>
  );
}

export function StartButton({ act, label = '▶️ מתחילים!' }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    unlockAudio();
    setBusy(true);
    await act('/start').catch(() => {});
    setBusy(false);
  };
  return (
    <Button className="py-4 text-xl" onClick={start} disabled={busy}>
      {busy ? 'בוחרים שירים...' : label}
    </Button>
  );
}

// חדר ההמתנה: מי כבר כאן, הגדרות, ו"מתחילים!"
export default function Lobby({ state, act }) {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <Invite code={state.code} />
        <Players state={state} act={act} />
      </div>
      <div className="flex flex-col gap-4">
        <Settings state={state} act={act} />
        {state.error && <Card className="text-center text-bad">{state.error}</Card>}
        <StartButton act={act} />
        <p className="text-center text-sm text-muted">🔊 להגביר את הקול! השיר מתחיל לבד בכל שאלה.</p>
      </div>
    </div>
  );
}
