// צ'אט צף: כפתור עגול + חלון (בטלפון – מגירה מעל הסרגל התחתון; במחשב – חלון נגרר).
// נשאר פתוח בין מסכים, ואפשר גם לפתוח אותו בחלון צף מעל הכול (Picture-in-Picture)
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, MessageCircle, Minus, PictureInPicture2, X } from 'lucide-react';
import { hasUnseen, lastBotLine, markSeen, loadChat, useChat } from '../lib/chatStore';
import ChatPanel from './ChatPanel';

const KEY = 'bursa-float-chat';
const TIP_KEY = 'bursa-float-tip';
const W = 380;
const H = 560;

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { open: !!v.open, min: !!v.min, pos: v.pos && Number.isFinite(v.pos.x) && Number.isFinite(v.pos.y) ? v.pos : null };
  } catch {
    return { open: false, min: false, pos: null };
  }
}

function useDesktop() {
  const q = '(min-width: 1024px)';
  const [d, setD] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => {
      m.removeEventListener('change', on);
    };
  }, []);
  return d;
}

const clamp = (pos, w, h) => ({
  x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w)),
  y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - h)),
});

const btn = 'flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-soft';

export default function FloatingChat({ symbol = '' }) {
  const chat = useChat();
  const desktop = useDesktop();
  const [saved, setSaved] = useState(readSaved);
  const [pip, setPip] = useState(null);
  const [tip, setTip] = useState(() => {
    try {
      return !localStorage.getItem(TIP_KEY);
    } catch {
      return true;
    }
  });
  const boxRef = useRef(null);
  const drag = useRef(null);
  const { open, min, pos } = saved;

  useEffect(() => {
    loadChat();
  }, []);

  const update = useCallback((patch) => {
    setSaved((s) => {
      const n = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(n));
      } catch {
        // אין אחסון – ממשיכים בלי לזכור
      }
      return n;
    });
  }, []);

  useEffect(() => {
    if (open && !min) markSeen();
  }, [open, min, chat.messages]);

  // לא יוצא מהמסך כשמשנים גודל חלון
  useEffect(() => {
    if (!pos) return undefined;
    const on = () => setSaved((s) => (s.pos ? { ...s, pos: clamp(s.pos, W, min ? 56 : H) } : s));
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
    };
  }, [pos, min]);

  const onDown = (e) => {
    if (!desktop || e.target.closest('button') || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setSaved((s) => ({ ...s, pos: clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }, d.w, d.h) }));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    update({});
  };

  const closeTip = () => {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      // לא נורא
    }
  };

  // חלון צף מעל הכול (Chrome במחשב)
  const canPip = typeof window !== 'undefined' && !!window.documentPictureInPicture;
  const openPip = async () => {
    try {
      const w = await window.documentPictureInPicture.requestWindow({ width: W, height: H });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
        w.document.head.appendChild(n.cloneNode(true));
      });
      const src = document.documentElement;
      w.document.documentElement.className = src.className;
      w.document.documentElement.dir = src.dir || 'rtl';
      w.document.documentElement.lang = src.lang || 'he';
      w.document.body.style.margin = '0';
      w.addEventListener('pagehide', () => {
        setPip(null);
      });
      setPip(w);
    } catch {
      window.dispatchEvent(new CustomEvent('bursa-toast', { detail: 'לא הצלחנו לפתוח חלון צף' }));
    }
  };
  useEffect(() => {
    return () => {
      if (pip) pip.close();
    };
  }, [pip]);

  const unseen = hasUnseen(chat);
  const line = lastBotLine(chat);
  const quick = symbol ? `מה דעתך על ${symbol}?` : '';

  const actions = (inPip) => (
    <div className="flex shrink-0 items-center">
      {!inPip && canPip && desktop && <button type="button" onClick={openPip} aria-label="חלון צף מעל הכול" title="חלון צף מעל הכול" className={btn}><PictureInPicture2 size={18} /></button>}
      {!inPip && <button type="button" onClick={() => update({ min: true })} aria-label="מזעור" className={btn}><Minus size={18} /></button>}
      {!inPip && <a href="#/chat" onClick={() => update({ open: false })} aria-label="לצ'אט המלא" className={btn}><Maximize2 size={17} /></a>}
      <button type="button" onClick={() => (inPip ? pip?.close() : update({ open: false }))} aria-label="סגירה" className={btn}><X size={19} /></button>
    </div>
  );

  const tipNote = tip ? (
    <div className="flex items-start gap-2 border-b border-line bg-soft px-3 py-2 text-xs text-muted lg:hidden">
      <p className="flex-1">רוצים לקרוא את הבוט בזמן שקונים באפליקציה אחרת (כמו בלינק)? בטלפון אנדרואיד: פותחים &apos;מסך מפוצל&apos; – בורסאי למעלה והאפליקציה השנייה למטה.</p>
      <button type="button" onClick={closeTip} aria-label="הבנתי, לא להציג שוב" className="shrink-0 rounded-md px-1.5 py-0.5 font-medium text-accent-ink">הבנתי</button>
    </div>
  ) : null;

  // חלון צף מעל הכול: הצ'אט מצויר בתוך חלון ה-PiP
  if (pip) {
    return createPortal(
      <div className="h-dvh bg-page text-ink">
        <ChatPanel compact quick={quick} actions={actions(true)} />
      </div>,
      pip.document.body,
    );
  }

  const base = 'bottom-[calc(3.5rem+env(safe-area-inset-bottom))]';
  const style = desktop && pos ? { left: pos.x, top: pos.y, bottom: 'auto', width: W, height: min ? undefined : Math.min(H, window.innerHeight - 16) } : undefined;
  const place = desktop
    ? `${pos ? '' : 'bottom-4 left-4'} w-[380px] ${min ? '' : 'h-[560px] max-h-[calc(100dvh-1rem)]'}`
    : `inset-x-0 ${base} ${min ? '' : 'h-[65dvh]'}`;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => update({ open: true, min: false })}
          aria-label="פתיחת הצ'אט עם בורסאי"
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] left-3 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg lg:bottom-5 lg:left-5"
        >
          <MessageCircle size={26} />
          <span className="absolute -bottom-0.5 -end-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-page bg-card text-xs font-bold text-accent-ink" aria-hidden="true">ב</span>
          {unseen && <span className="absolute end-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-page bg-down" role="status" aria-label="הודעה חדשה" />}
        </button>
      )}

      {open && (
        <div ref={boxRef} style={style} className={`fixed z-40 flex flex-col overflow-hidden border border-line bg-card shadow-2xl ${place} rounded-t-2xl lg:rounded-2xl`}>
          {min ? (
            <div className="flex items-center gap-2 px-3 py-2" {...(desktop ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, style: { touchAction: 'none', cursor: 'grab' } } : {})}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent" aria-hidden="true">ב</span>
              <button type="button" onClick={() => update({ min: false })} className="min-w-0 flex-1 truncate text-start text-sm text-ink" aria-label="הרחבת הצ'אט">
                {chat.busy ? 'מקליד...' : line || 'בורסאי'}
              </button>
              <button type="button" onClick={() => update({ min: false })} aria-label="הרחבה" className={btn}><Maximize2 size={17} /></button>
              <button type="button" onClick={() => update({ open: false })} aria-label="סגירה" className={btn}><X size={19} /></button>
            </div>
          ) : (
            <ChatPanel
              compact
              quick={quick}
              topNote={tipNote}
              actions={actions(false)}
              headerProps={desktop ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, style: { touchAction: 'none', cursor: 'grab' } } : {}}
            />
          )}
        </div>
      )}
    </>
  );
}
