// צ'אט בסגנון וואטסאפ: ההודעות שלי משמאל (ירוק), של הבוט מימין.
// משמש גם במסך המלא (#/chat) וגם בחלון הצף (compact)
import { useEffect, useRef, useState } from 'react';
import { CheckCheck, Send, Trash2 } from 'lucide-react';
import { stockLink } from '../lib/route';
import { answerProposal, clearChat, loadChat, markSeen, sendChat, useChat } from '../lib/chatStore';
import Md from './Md';

const SUGGESTIONS = ['מה מצב השוק היום?', 'מה כדאי לקנות עכשיו?', 'איך התיק שלי?', 'מה זה RSI?', 'איך מתחילים להשקיע 1000 ₪?'];

const clock = (ms) => new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

// כרטיס הצעה: מניה שהבוט מציע להוסיף לרשימת הקניות
function Proposal({ p, onAnswer, sending }) {
  return (
    <div className="rounded-xl border border-line bg-soft p-2.5 text-sm">
      <a href={stockLink(p.symbol)} className="font-bold text-accent-ink"><bdi>{p.name || p.symbol}</bdi> <span dir="ltr" className="text-xs font-normal text-muted">{p.symbol}</span></a>
      {p.reason && <p className="mt-1 text-muted">{p.reason}</p>}
      {typeof p.target === 'number' && <div className="mt-1 text-xs text-muted">מחיר קנייה מוצע: <b dir="ltr" className="text-ink">{p.target}</b></div>}
      {p.status === 'added' ? (
        <div className="mt-2 font-medium text-up">✓ נוסף לרשימת הקניות · <a href="#/portfolio?tab=buy" className="underline">לרשימה</a></div>
      ) : p.status === 'declined' ? (
        <div className="mt-2 text-muted">לא נוסף</div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={sending} onClick={() => onAnswer(p.id, true)} className="min-h-9 rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-50">🛒 להוסיף לרשימת הקניות</button>
          <button type="button" disabled={sending} onClick={() => onAnswer(p.id, false)} className="min-h-9 rounded-lg border border-line bg-card px-3 text-muted disabled:opacity-50">לא תודה</button>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, onAnswer, sending, compact }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative rounded-2xl px-3 pb-1.5 pt-2 text-[15px] shadow-sm ${compact ? 'max-w-[92%]' : 'max-w-[85%] lg:max-w-[70%]'} ${
          m.error ? 'border border-down/40 bg-down-soft text-down' : mine ? 'rounded-br-md bg-mine text-mine-ink' : 'rounded-bl-md bg-card text-ink'
        }`}
      >
        {mine || m.error ? <div className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</div> : <Md text={m.text} />}
        {!mine && m.proposals?.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {m.proposals.map((p) => <Proposal key={p.id} p={p} onAnswer={onAnswer} sending={sending} />)}
          </div>
        )}
        <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${mine ? 'justify-end text-mine-ink/70' : 'justify-end text-muted'}`}>
          <span dir="ltr">{clock(m.t)}</span>
          {mine && <CheckCheck size={14} className="text-accent" aria-label="נשלח" />}
        </div>
      </div>
    </div>
  );
}

// compact: חלון צף (גובה מהמיכל, בלי מחיקה). actions: כפתורים בכותרת. headerProps: מאפייני גרירה לכותרת.
// quick: צ'יפ מהיר מעל התיבה. topNote: הודעה קטנה מעל ההודעות. params: ?q= מדף מניה (מסך מלא)
export default function ChatPanel({ params, compact = false, actions = null, headerProps = {}, quick = '', topNote = null }) {
  const { messages, loaded, busy, answering, notice } = useChat();
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadChat();
  }, []);

  // הפאנל פתוח = ההודעות נראות
  useEffect(() => {
    markSeen();
  }, [messages]);

  // טקסט מוכן מדף מניה: נכנס לתיבה (לא נשלח לבד)
  const q = params ? params.get('q') : '';
  useEffect(() => {
    if (!q) return;
    setText(q);
    window.history.replaceState(null, '', '#/chat');
    inputRef.current?.focus();
  }, [q]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, notice]);

  // התיבה גדלה עם הטקסט
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const send = (raw) => {
    const msg = (raw ?? text).trim();
    if (!msg || busy) return;
    setText('');
    sendChat(msg);
  };

  const clear = () => {
    if (!window.confirm('למחוק את כל השיחה?')) return;
    clearChat();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col bg-page' : 'flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col lg:h-dvh'}>
      <header {...headerProps} className={`flex items-center gap-3 border-b border-line bg-card ${compact ? 'px-3 py-2' : 'px-4 py-2.5'} ${headerProps.className || ''}`}>
        <span className={`flex items-center justify-center rounded-full bg-accent font-bold text-on-accent ${compact ? 'h-9 w-9 text-base' : 'h-10 w-10 text-lg'}`} aria-hidden="true">ב</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">בורסאי</div>
          <div className={`text-xs ${busy ? 'text-accent-ink' : 'text-muted'}`} role="status">{busy ? 'מקליד...' : 'עוזר ההשקעות שלכם'}</div>
        </div>
        {!compact && messages.length > 0 && (
          <button type="button" onClick={clear} aria-label="מחיקת השיחה" className="rounded-lg p-2 text-muted hover:bg-soft"><Trash2 size={20} /></button>
        )}
        {actions}
      </header>

      {topNote}

      <div className="chat-wall min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {loaded && messages.length === 0 && !busy && (
            <div className="my-6 flex flex-col items-center gap-4 text-center">
              <div className="max-w-xs rounded-2xl bg-card/90 p-4 text-sm shadow-sm">
                <b>היי! אני בורסאי.</b>
                <p className="mt-1 text-muted">אפשר לשאול אותי על מניות, על השוק, על התיק שלכם או על מושגים שלא ברורים. אני מסביר בפשטות.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-accent-ink shadow-sm hover:bg-soft">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => <Bubble key={`${m.t}-${i}`} m={m} compact={compact} onAnswer={answerProposal} sending={answering} />)}
          {busy && (
            <div className="flex justify-start">
              <div className="typing rounded-2xl rounded-bl-md bg-card px-3 py-3 shadow-sm" aria-label="מקליד"><span /><span /><span /></div>
            </div>
          )}
          {notice && <Bubble m={notice} compact={compact} />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line bg-card px-3 py-2">
        {quick && (
          <div className="mx-auto mb-2 flex max-w-3xl">
            <button type="button" disabled={busy} onClick={() => send(quick)} className="rounded-full border border-line bg-soft px-3 py-1 text-sm text-accent-ink disabled:opacity-50">{quick}</button>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="כתבו הודעה..."
            aria-label="הודעה"
            className="max-h-36 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-page px-4 py-2.5 text-base text-ink outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!text.trim() || busy}
            aria-label="שליחה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition disabled:opacity-40"
          >
            <Send size={20} className="-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
