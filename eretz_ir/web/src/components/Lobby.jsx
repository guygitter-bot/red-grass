import { useState } from 'react';
import { inviteLink } from '../lib/game';
import { recentLetters } from '../lib/profile';
import { Avatar, Button, Card, TimePicker } from './ui';
import { CallFriends } from './Clubs';

const INVITE_TEXT = 'בואו לשחק איתי ארץ עיר! 🌍';

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
      await navigator.share({ title: 'ארץ עיר', text: INVITE_TEXT, url });
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

// חדר ההמתנה: מי כבר כאן, כמה זמן לסיבוב, ו"מתחילים!"
export default function Lobby({ state, act, profile }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    await act('/start', { seconds: state.seconds, recent: recentLetters() }).catch(() => {});
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <Invite code={state.code} />
        <CallFriends profile={profile} game={state.code} />
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-3 font-bold">מי כבר כאן ({state.players.length})</div>
          <ul className="flex flex-col gap-2">
            {state.players.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar player={p} size={44} />
                <span className="text-lg">{p.name}</span>
                {p.id === state.me && <span className="text-sm text-muted">(את/ה)</span>}
                {p.id === state.hostId && <span className="mr-auto text-sm text-muted">👑 פתח/ה את המשחק</span>}
              </li>
            ))}
          </ul>
          {state.players.length < 2 && <p className="mt-3 text-sm text-muted">מחכים לחברים... (אפשר גם להתחיל לבד, לאימון)</p>}
        </Card>
        <Card className="flex flex-col gap-3 text-center">
          <div className="font-bold">כמה זמן לכל סיבוב?</div>
          <TimePicker value={state.seconds} onChange={(seconds) => act('/settings', { seconds }).catch(() => {})} />
          <Button className="py-4 text-xl" onClick={start} disabled={busy}>
            ▶️ מתחילים!
          </Button>
        </Card>
      </div>
    </div>
  );
}
