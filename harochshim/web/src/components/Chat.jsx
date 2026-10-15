// שיחה עם העוזר החכם של ספק. כשהעוזר מזהה שהלקוח מוכן – מופיע כפתור "שיחזרו אליי" עם הסיכום
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../lib/api';
import { Sheet } from './ui';

export default function Chat({ supplier, offer, onClose, onHandoff }) {
  const hello = offer
    ? `שלום! אני העוזר החכם של ${supplier.name}. מה תרצו לדעת על "${offer.title}"?`
    : `שלום! אני העוזר החכם של ${supplier.name}. אפשר לשאול אותי על המוצרים, המחירים לחברי הרוכשים, אחריות ואספקה.`;
  const [messages, setMessages] = useState([{ role: 'assistant', text: hello }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState(null);
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, busy, handoff]);

  const send = async (e) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    // השאלה הראשונה על הצעה מסוימת – מוסיפים את שם ההצעה כדי שהעוזר ידע במה מדובר
    const asked = offer && messages.length === 1 ? `(לגבי ההצעה: ${offer.title})\n${q}` : q;
    const next = [...messages, { role: 'user', text: q }];
    const toSend = [...messages, { role: 'user', text: asked }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError('');
    try {
      const res = await api('/chat', { supplierId: supplier.id, chat: toSend });
      setMessages([...next, { role: 'assistant', text: res.reply }]);
      if (res.handoff) setHandoff(res.handoff.summary);
    } catch (err) {
      setError(err.message);
      setMessages(messages);
      setText(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`העוזר של ${supplier.name}`} onClose={onClose}>
      <div className="flex min-h-[50dvh] flex-col gap-2 p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 ${m.role === 'user' ? 'self-start bg-sky text-navy' : 'self-end border border-line bg-page'}`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="self-end rounded-2xl border border-line bg-page px-3.5 py-2 text-muted">כותב…</div>}
        {handoff && (
          <button onClick={() => onHandoff(handoff, messages)} className="mt-1 self-stretch rounded-xl bg-coral px-4 py-3 font-bold text-white">
            כן, שהספק יחזור אליי
          </button>
        )}
        {error && <div className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-coral-ink">{error}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 flex items-end gap-2 border-t border-line bg-card p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          rows={1}
          maxLength={1000}
          placeholder="כתבו שאלה…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-page px-3 py-2.5 text-base outline-none focus:border-sky"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-coral p-3 text-white disabled:opacity-50" aria-label="שליחה">
          <Send size={18} className="-scale-x-100" />
        </button>
      </form>
      <div className="px-4 pb-3 text-center text-xs text-muted">
        עוזר ממוחשב. המחיר הסופי נקבע מול הספק.{' '}
        {!handoff && (
          <button onClick={() => onHandoff('', messages.length > 1 ? messages : [])} className="text-sky-ink underline">
            להשאיר פרטים עכשיו
          </button>
        )}
      </div>
    </Sheet>
  );
}
