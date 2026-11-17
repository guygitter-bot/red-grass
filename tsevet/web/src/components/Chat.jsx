// מסך שיחה: הודעות, מחוון "כותב…", ושורת כתיבה. רענון לפי מצב השיחה
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Headphones, Send, Square } from 'lucide-react';
import { api } from '../lib/api';
import { go, getPreset } from '../lib/route';
import { convInterval } from '../lib/polling';
import { usePoll } from '../lib/usePoll';
import { mergeConv } from '../lib/stable';
import { findAgent } from '../lib/agents';
import Message from './Message';
import { RELOAD } from './Gen';
import Composer from './Composer';
import { MIC_BLOCKED, askMic, canListen, canSpeak, hasHebrewVoice, speak, stopSpeaking } from '../lib/voice';
import { Button, Sheet, Spinner, inputCls } from './ui';

export default function Chat({ id, agents, refresh }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState('');
  const [to, setTo] = useState(() => getPreset(id));
  const [sending, setSending] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const scroller = useRef(null);
  const nearBottom = useRef(true);
  const justSent = useRef(false);

  // שיחה קולית: התשובות של הבוטים מוקראות, ואחרי שהבוט סיים – המיקרופון נפתח שוב לבד
  const [voice, setVoice] = useState(() => {
    try {
      return localStorage.getItem('tsevet-voice') === '1';
    } catch {
      return false;
    }
  });
  const [listenTick, setListenTick] = useState(0);
  const [voiceNote, setVoiceNote] = useState('');
  const spokenUpTo = useRef(null); // ההודעה האחרונה שכבר הוקראה (או שהייתה לפני שהמצב הופעל)
  const busyRef = useRef(false);
  const micBlocked = useRef(false); // המיקרופון נחסם – לא פותחים אותו לבד אחרי כל תשובה

  const load = useCallback(
    () =>
      api('/app/conv', { id })
        .then((c) => {
          setConv((prev) => mergeConv(prev, c));
          setError('');
        })
        .catch((e) => setError(e.message)),
    [id],
  );
  usePoll(load, convInterval(conv));

  // כרטיס בתוך הודעה (אישור יצירת סרטון) מבקש לרענן את השיחה
  useEffect(() => {
    window.addEventListener(RELOAD, load);
    return () => {
      window.removeEventListener(RELOAD, load);
    };
  }, [load]);

  busyRef.current = Boolean(conv?.busy);
  const lastI = conv?.messages?.length ? conv.messages[conv.messages.length - 1].i : -1;

  // הודעות חדשות של הבוטים – להקראה
  useEffect(() => {
    if (!conv) return;
    if (!voice || spokenUpTo.current === null) {
      spokenUpTo.current = lastI;
      return;
    }
    const fresh = conv.messages.filter((m) => m.i > spokenUpTo.current && m.who !== 'owner' && m.who !== 'system' && m.text);
    spokenUpTo.current = lastI;
    if (!fresh.length) return;
    const text = fresh.map((m) => m.text).join('\n');
    speak(text, () => {
      if (!busyRef.current && !micBlocked.current) setListenTick((n) => n + 1);
    });
  }, [lastI, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  // יציאה מהשיחה – מפסיקים להקריא
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [id]);

  const toggleVoice = () => {
    const on = !voice;
    setVoice(on);
    try {
      localStorage.setItem('tsevet-voice', on ? '1' : '0');
    } catch {
      /* לא נשמר – לא נורא */
    }
    spokenUpTo.current = lastI;
    if (!on) {
      stopSpeaking();
      setVoiceNote('');
      return;
    }
    setVoiceNote(canSpeak() && !hasHebrewVoice() ? 'אין במכשיר הזה קול בעברית – ההקראה עלולה להישמע לא טוב.' : '');
    // פתיחה בלחיצה (בטלפון ההקראה והמיקרופון חייבים להתחיל מלחיצה): ההקראה מתחילה מיד,
    // ובמקביל כרום שואל על המיקרופון. מקשיבים רק אחרי שהרשות ניתנה.
    micBlocked.current = false;
    const mic = canListen() ? askMic() : Promise.resolve(false);
    speak('מצב שיחה קולית. דברו.', async () => {
      if (await mic) setListenTick((n) => n + 1);
    });
    mic.then((ok) => {
      if (!ok && canListen()) {
        micBlocked.current = true;
        setVoiceNote(MIC_BLOCKED);
      }
    });
  };

  // גלילה למטה רק אם המשתמשת כבר קרובה לתחתית, או כששלחה הודעה
  const count = conv?.messages?.length || 0;
  const busyKey = conv?.busy ? 'b' : '';

  // כשהבוטים מסיימים – לרענן גם את רשימת השיחות ואת הלוח (שהסימון "עובד" ייעלם מיד)
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busyKey) refresh();
    wasBusy.current = Boolean(busyKey);
  }, [busyKey, refresh]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (nearBottom.current || justSent.current) {
      el.scrollTop = el.scrollHeight;
      justSent.current = false;
    }
  }, [count, busyKey]);

  const onScroll = () => {
    const el = scroller.current;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const send = async (text, files) => {
    setSending(true);
    try {
      await api('/app/send', { id, text, to, files });
      justSent.current = true;
      await load();
      refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const stop = async () => {
    try {
      await api('/app/stop', { id });
    } catch (e) {
      setError(e.message);
    }
    load();
    refresh();
  };

  const saveTitle = async () => {
    try {
      await api('/app/conv/rename', { id, title: title.trim() });
      setRenaming(false);
      load();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const busyAgent = conv?.busy?.agent ? findAgent(agents, conv.busy.agent) : null;
  // סקיל חדש שמחכה לאישור – תזכורת קבועה מעל שורת הכתיבה (הכרטיס עצמו יכול להיות רחוק למעלה)
  const waiting = (conv?.messages || []).flatMap((m) => m.skills || []).filter((s) => s.status === 'pending');
  const approveSkill = async (name) => {
    try {
      await api('/app/skills/approve', { name });
    } catch (e) {
      setError(e.message);
    }
    load();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-card px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button onClick={() => go('/chats')} className="rounded-full p-2 text-muted hover:bg-soft lg:hidden" aria-label="חזרה">
          <ArrowRight size={22} />
        </button>
        <button
          className="min-w-0 flex-1 truncate text-start text-lg font-bold"
          onClick={() => {
            setTitle(conv?.title || '');
            setRenaming(true);
          }}
          title="שינוי שם"
        >
          {conv?.title || 'שיחה'}
        </button>
        {(canListen() || canSpeak()) && (
          <button
            onClick={toggleVoice}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${voice ? 'bg-accent text-white' : 'border border-line text-muted hover:bg-soft'}`}
            aria-pressed={voice}
            title="שיחה קולית: מדברים, והתשובות מוקראות"
          >
            <Headphones size={16} />
            <span className="hidden sm:inline">{voice ? 'שיחה קולית פעילה' : 'שיחה קולית'}</span>
          </button>
        )}
        {conv?.source === 'tg' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-xs text-accent-ink">
            <Send size={11} /> Telegram
          </span>
        )}
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-3 pb-4">
          {!conv && !error && <p className="p-6 text-center text-muted">רגע…</p>}
          {error && <p className="rounded-xl border border-line bg-card p-3 text-sm text-bad">{error}</p>}
          {conv && conv.messages.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">{to ? `כתבו הודעה ל${findAgent(agents, to)?.name || 'בוט'} כדי להתחיל.` : 'כתבו הודעה, והצוות יחליט מי עונה.'}</p>
          )}
          {conv?.messages.map((m) => (
            <Message key={m.i} m={m} agents={agents} />
          ))}
          {conv?.busy && (
            <div className="flex items-center gap-2 self-end rounded-full border border-line bg-card px-3.5 py-2 text-sm">
              <Spinner size={12} />
              <span>
                {busyAgent ? `${busyAgent.emoji} ${busyAgent.name} כותב…` : 'הצוות מחליט מי עונה…'}
                {conv.busy.step && <span className="text-muted"> (שלב {conv.busy.step.n} מתוך {conv.busy.step.of})</span>}
              </span>
              <button onClick={stop} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-bad hover:bg-soft">
                <Square size={10} fill="currentColor" /> עצור
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-card">
        <div className="mx-auto max-w-3xl">
      {waiting.length > 0 && (
        <div className="border-t border-line bg-soft px-4 py-2 text-sm">
          {waiting.map((sk) => (
            <div key={sk.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words">🧩 {sk.update ? 'עדכון לסקיל' : 'סקיל'} שמחכה לאישור שלך: <b>{sk.title || sk.name}</b></span>
              <Button className="shrink-0 !px-3 !py-1.5 text-sm" onClick={() => approveSkill(sk.name)}>
                לאשר
              </Button>
            </div>
          ))}
        </div>
      )}
          {voice && <p className="px-4 pt-2 text-xs text-muted">🎧 שיחה קולית: מדברים, ההודעה נשלחת לבד, והתשובה מוקראת. {voiceNote}</p>}
          <Composer agents={agents} to={to} setTo={setTo} onSend={send} sending={sending} voice={voice} listenTick={listenTick} onMicBlocked={() => {
            micBlocked.current = true;
            setVoiceNote(MIC_BLOCKED);
          }} />
        </div>
      </div>

      {renaming && (
        <Sheet title="שינוי שם לשיחה" onClose={() => setRenaming(false)}>
          <input className={`${inputCls} mb-3`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={80} />
          <Button className="w-full" disabled={!title.trim()} onClick={saveTitle}>
            שמירה
          </Button>
        </Sheet>
      )}
    </div>
  );
}
