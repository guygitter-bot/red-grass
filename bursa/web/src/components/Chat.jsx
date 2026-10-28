// צ'אט בסגנון וואטסאפ: ההודעות שלי משמאל (ירוק), של הבוט מימין
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, Send, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import Md from './Md';

const SUGGESTIONS = ['מה מצב השוק היום?', 'מה כדאי לקנות עכשיו?', 'איך התיק שלי?', 'מה זה RSI?', 'איך מתחילים להשקיע 1000 ₪?'];

const clock = (ms) => new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

function Bubble({ m }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] rounded-2xl px-3 pb-1.5 pt-2 text-[15px] shadow-sm lg:max-w-[70%] ${
          m.error ? 'border border-down/40 bg-down-soft text-down' : mine ? 'rounded-br-md bg-mine text-mine-ink' : 'rounded-bl-md bg-card text-ink'
        }`}
      >
        {mine || m.error ? <div className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</div> : <Md text={m.text} />}
        <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${mine ? 'justify-end text-mine-ink/70' : 'justify-end text-muted'}`}>
          <span dir="ltr">{clock(m.t)}</span>
          {mine && <CheckCheck size={14} className="text-accent" aria-label="נשלח" />}
        </div>
      </div>
    </div>
  );
}

export default function Chat({ params }) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api('/chat/history')
      .then((r) => setMessages(r.messages))
      .catch((e) => setNotice({ role: 'assistant', text: e.message, t: Date.now(), error: true }))
      .finally(() => setLoaded(true));
  }, []);

  // טקסט מוכן מדף מניה: נכנס לתיבה (לא נשלח לבד)
  const q = params.get('q');
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

  const send = useCallback(async (raw) => {
    const msg = (raw ?? text).trim();
    if (!msg || busy) return;
    setText('');
    setNotice(null);
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: msg, t: Date.now() }]);
    try {
      const r = await api('/chat', { text: msg });
      setMessages(r.messages);
    } catch (e) {
      setNotice({ role: 'assistant', text: e.message, t: Date.now(), error: true });
    } finally {
      setBusy(false);
    }
  }, [text, busy]);

  const clear = async () => {
    if (!window.confirm('למחוק את כל השיחה?')) return;
    try {
      await api('/chat/clear');
      setMessages([]);
      setNotice(null);
    } catch (e) {
      setNotice({ role: 'assistant', text: e.message, t: Date.now(), error: true });
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col lg:h-dvh">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent" aria-hidden="true">ב</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">בורסאי</div>
          <div className={`text-xs ${busy ? 'text-accent-ink' : 'text-muted'}`} role="status">{busy ? 'מקליד...' : 'עוזר ההשקעות שלכם'}</div>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} aria-label="מחיקת השיחה" className="rounded-lg p-2 text-muted hover:bg-soft"><Trash2 size={20} /></button>
        )}
      </header>

      <div className="chat-wall flex-1 overflow-y-auto px-3 py-4">
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
          {messages.map((m, i) => <Bubble key={`${m.t}-${i}`} m={m} />)}
          {busy && (
            <div className="flex justify-start">
              <div className="typing rounded-2xl rounded-bl-md bg-card px-3 py-3 shadow-sm" aria-label="מקליד"><span /><span /><span /></div>
            </div>
          )}
          {notice && <Bubble m={notice} />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-line bg-card px-3 py-2">
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
