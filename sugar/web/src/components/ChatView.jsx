// שיחה עם ה-AI, כמו בוואטסאפ. השיחה משותפת לכל מי שנכנס עם הסיסמה (כל הודעה נשמרת ומסתנכרנת, עם שם השואל).
// בכל שאלה נשלח ל-AI סיכום מלא ועדכני של היומן (aiContext): הגדרות, סטטיסטיקה, דפוס לכל ארוחה ופירוט 3 השבועות האחרונים.
import { useEffect, useRef, useState } from 'react';
import { Bot, Copy, Download, Send, Share2, Trash2 } from 'lucide-react';
import { aiContext } from '../lib/diary';
import { askAi, remove } from '../lib/store';
import { getMe } from '../lib/me';
import Markdown from './Markdown';

const QUICK = [
  'נתח/י את ארוחת הצהריים: כמה אינסולין עבד הכי טוב?',
  'איפה היו נמוכים בשבועיים האחרונים, ולמה?',
  'מה הדפוס בבקרים?',
  'סכם/י את השבוע להעביר לרופאה',
  'מה כדאי לרשום כדי שנבין טוב יותר?',
];

// שאלה מוכנה ממסך אחר (למשל "ניתוח מעמיק" במעקב) – ממלאת את התיבה, והשליחה בלחיצה (כדי שלא תצא שאלה בטעות)
let pending = '';
export function askLater(q) {
  pending = q;
}

// טקסט נקי לשיתוף (בלי סימני העיצוב ** ו-##)
export const plain = (text) =>
  String(text || '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,4}\s+/gm, '')
    .trim();

function download(name, text) {
  const url = URL.createObjectURL(new Blob([`\ufeff${text}`], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const timeOf = (at) => new Date(at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const dateOf = (at) => new Date(at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

export default function ChatView({ data }) {
  const [text, setText] = useState(() => {
    const q = pending;
    pending = '';
    return q;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const me = getMe();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data.chats.length, busy]);

  const ask = async (q) => {
    q = q.trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    setText('');
    try {
      await askAi(aiContext(data, data.today), q, data.chats, me);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [note, setNote] = useState('');
  const flash = (t) => {
    setNote(t);
    setTimeout(() => setNote(''), 2000);
  };

  // התשובה עם השאלה שלפניה – כדי שמי שמקבל יבין על מה מדובר
  const withQuestion = (c) => {
    const i = data.chats.findIndex((x) => x.id === c.id);
    const q = [...data.chats.slice(0, i)].reverse().find((x) => x.role === 'user');
    return `${q ? `שאלה: ${q.text}\n\n` : ''}תשובה (יומן סוכר, ${dateOf(c.at)}):\n${plain(c.text)}`;
  };
  const copy = async (c) => {
    try {
      await navigator.clipboard.writeText(withQuestion(c));
      flash('הועתק');
    } catch {
      flash('לא הצלחתי להעתיק');
    }
  };
  const share = async (c) => {
    const text = withQuestion(c);
    try {
      if (navigator.share) await navigator.share({ title: 'יומן סוכר – תשובת AI', text });
      else {
        await navigator.clipboard.writeText(text);
        flash('אין שיתוף בדפדפן הזה – הטקסט הועתק');
      }
    } catch {
      // ביטול השיתוף
    }
  };
  const exportAll = () =>
    download(
      `yoman-sukar-ai-chat-${data.today}.txt`,
      data.chats.map((c) => `[${dateOf(c.at)} ${timeOf(c.at)}] ${c.role === 'user' ? c.by || 'שאלה' : 'AI'}:\n${plain(c.text)}`).join('\n\n'),
    );

  let lastDate = '';
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full bg-accent p-2 text-white">
          <Bot size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold">שאלות ל-AI</h1>
          <p className="text-xs text-muted">רואה את כל היומן ועונה לפי הנתונים שלכם. לא מחליף את הצוות הרפואי.</p>
        </div>
        {data.chats.length > 0 && (
          <button onClick={exportAll} className="mr-auto flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-accent-ink hover:bg-soft" title="הורדת כל השיחה כקובץ">
            <Download size={16} /> ייצוא השיחה
          </button>
        )}
      </div>
      {note && <p className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-page shadow-lg">{note}</p>}

      <div className="mb-3 space-y-2 rounded-2xl bg-soft/50 p-3">
        {!data.chats.length && <p className="p-4 text-center text-sm text-muted">אפשר לשאול כל שאלה על הסוכר, הארוחות והאינסולין. כל מי שמשתף את היומן רואה את השיחה.</p>}
        {data.chats.map((c) => {
          const d = dateOf(c.at);
          const showDate = d !== lastDate;
          lastDate = d;
          const mine = c.role === 'user';
          return (
            <div key={c.id}>
              {showDate && <div className="my-2 text-center text-xs text-muted">{d}</div>}
              <div className={`group flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm lg:max-w-[75%] ${mine ? 'rounded-tr-sm bg-bubble' : 'rounded-tl-sm bg-card'}`}>
                  {mine && c.by && <div className="text-xs font-bold text-accent-ink">{c.by}</div>}
                  {mine ? <p className="whitespace-pre-wrap">{c.text}</p> : <Markdown text={c.text} />}
                  {!mine && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2 text-xs">
                      <button onClick={() => copy(c)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-accent-ink hover:bg-soft">
                        <Copy size={14} /> העתקה
                      </button>
                      <button onClick={() => share(c)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-accent-ink hover:bg-soft">
                        <Share2 size={14} /> שיתוף
                      </button>
                      <button onClick={() => download(`yoman-sukar-ai-${data.today}.txt`, withQuestion(c))} className="flex items-center gap-1 rounded-lg px-2 py-1 text-accent-ink hover:bg-soft">
                        <Download size={14} /> הורדה
                      </button>
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-muted">
                    <button
                      onClick={() => {
                        if (confirm('למחוק את ההודעה (אצל כולם)?')) remove(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="מחיקת הודעה"
                    >
                      <Trash2 size={12} />
                    </button>
                    {timeOf(c.at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm text-muted shadow-sm">
              <span className="animate-pulse">בודק את היומן וחושב… (עד דקה)</span>
            </div>
          </div>
        )}
        {error && <p className="rounded-xl bg-card p-3 text-sm text-minus">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
        {QUICK.map((q) => (
          <button key={q} disabled={busy} onClick={() => ask(q)} className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:bg-soft disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="sticky bottom-20 flex items-end gap-2 lg:bottom-4"
      >
        <textarea
          className="max-h-40 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
          rows={text.length > 60 ? 4 : 1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 1024px)').matches) {
              e.preventDefault();
              ask(text);
            }
          }}
          placeholder="כתבו שאלה…"
          disabled={busy}
        />
        <button disabled={busy || !text.trim()} className="rounded-full bg-accent p-3 text-white disabled:opacity-50" aria-label="שליחה">
          <Send size={20} className="-scale-x-100" />
        </button>
      </form>
    </div>
  );
}
