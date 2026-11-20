import { useEffect, useMemo, useRef } from 'react';
import { PIECES } from '../lib/kit';
import { rowsFor } from '../lib/lesson';

// צבעי הנוטות לפי סוג החלק (כמו ציר הזמן) ולפי היד בתרגילי טכניקה
const NOTE = { kick: '#ffb21f', snare: '#f2ede4', tom: '#a08cff', floor: '#a08cff', hihat: '#e2bf62', hihatOpen: '#e2bf62', crash: '#e2bf62', ride: '#e2bf62', china: '#e2bf62', splash: '#e2bf62', cowbell: '#9aa0aa' };
const HAND = { R: '#ff4fa3', L: '#4fd6ff' };
const HAND_LABEL = { L: 'L שמאל', R: 'R ימין' };
const BG = '#07080a';

// "מסלול": תצוגת משחק קצב. מסלול לכל חלק בסעיף, הנוטות יורדות אל קו המכה (כל מה שמעליו עוד לפניכם).
// קנבס 2D (ביצועים), מצויר רק כשיש תנועה. "פחות תנועה" = הנוטות עומדות והסרגל הוא שנע.
// posRef = { pos (שניות בסעיף, שלילי בספירה), loopLen, looping } מתעדכן מבחוץ (useLesson); lookahead = כמה שניות קדימה רואים
export default function Highway({ section, posRef, lookahead }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  // תרגיל על חלק אחד (למשל סנר) – שני מסלולים לפי היד (שמאל / ימין); אחרת מסלול לכל חלק
  const pieces = useMemo(() => rowsFor(section), [section]);
  const handMode = !!section.hands && pieces.length === 1;
  const lanes = useMemo(() => (handMode ? ['L', 'R'] : pieces), [handMode, pieces]);
  const events = useMemo(() => {
    const out = [];
    for (const p of pieces) for (const i of section.hits[p]) {
      const hand = section.hands?.[p]?.[i] || null;
      out.push({ p, lane: handMode ? hand : p, i, hand, soft: !!section.soft?.[p]?.includes(i) });
    }
    return out;
  }, [section, pieces, handMode]);
  const view = useRef({});
  view.current = { section, lanes, events, lookahead };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const c = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let idleDrawn = false;
    let seenSection = null;
    let seenLook = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      idleDrawn = false;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const draw = (p) => {
      const { section: sec, lanes: ln, events: evs, lookahead: look } = view.current;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = BG;
      c.fillRect(0, 0, w, h);
      if (!ln.length) return;
      const labelH = h > 120 ? 16 : 13;
      const hitY = h - labelH - 7;
      const top = 3;
      const span = hitY - top;
      const laneW = w / ln.length;
      const loopLen = p ? p.loopLen : 1;
      const spb = loopLen / (sec.bars * 4);
      const pos = p ? p.pos : -0.12 * look; // בלי ריצה – תצוגה מקדימה של הנוטות הראשונות
      const noteH = Math.max(9, Math.min(16, h * 0.11));

      // מסלולים: פס עדין לכל חלק
      for (let k = 0; k < ln.length; k++) {
        c.fillStyle = k % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)';
        c.fillRect(k * laneW, 0, laneW, h - labelH);
      }
      // y של זמן t (שניות בסעיף). רגיל: יורד אל הקו; "פחות תנועה": הנוטות קבועות לפי מקומן בתיבה
      const yOf = (t) => (reduced ? top + (t / loopLen) * span : hitY - ((t - pos) / look) * span);

      // קווי פעמה
      c.lineWidth = 1;
      const beatCount = sec.bars * 4;
      if (reduced) {
        for (let b = 0; b < beatCount; b++) {
          c.strokeStyle = b % 4 === 0 ? 'rgba(255,178,31,0.4)' : 'rgba(255,255,255,0.1)';
          const y = Math.round(yOf(b * spb)) + 0.5;
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(w, y);
          c.stroke();
        }
      } else {
        const b0 = Math.floor(pos / spb);
        for (let b = b0; b <= b0 + Math.ceil(look / spb) + 1; b++) {
          if (!p?.looping && p && (b < 0 || b > beatCount)) continue;
          const y = yOf(b * spb);
          if (y < top || y > hitY) continue;
          c.strokeStyle = ((b % 4) + 4) % 4 === 0 ? 'rgba(255,178,31,0.4)' : 'rgba(255,255,255,0.1)';
          c.beginPath();
          c.moveTo(0, Math.round(y) + 0.5);
          c.lineTo(w, Math.round(y) + 0.5);
          c.stroke();
        }
      }

      // נוטות
      const drawNote = (ev, t) => {
        const y = yOf(t);
        if (!reduced && (y < top - noteH || y > hitY + noteH * 0.9)) return;
        const x = ln.indexOf(ev.lane) * laneW + laneW / 2;
        const nw = Math.min(laneW * 0.8, 34) * (ev.soft ? 0.78 : 1);
        const near = !reduced && Math.abs(t - pos) < 0.06;
        const base = ln.length === 2 && ev.hand && ln[0] === 'L' ? HAND[ev.hand] : NOTE[PIECES[ev.p].type] || '#ccc';
        c.globalAlpha = ev.soft ? 0.55 : y > hitY + 2 ? 0.35 : 1;
        c.fillStyle = base;
        const rx = x - nw / 2;
        const ry = y - noteH / 2;
        c.beginPath();
        c.roundRect ? c.roundRect(rx, ry, nw, noteH, 3) : c.rect(rx, ry, nw, noteH);
        c.fill();
        if (near) {
          c.strokeStyle = '#fff';
          c.lineWidth = 2;
          c.stroke();
        }
        if (ev.hand) {
          c.fillStyle = '#0b0b0e';
          c.font = `800 ${Math.round(noteH * 0.82)}px Heebo, sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(ev.hand, x, y + 0.5);
          // פס צבע היד בצד, כדי לראות את היד גם כשהצבע של הנוטה הוא של החלק
          c.fillStyle = HAND[ev.hand];
          c.fillRect(rx, ry + noteH - 2, nw, 2);
        }
        c.globalAlpha = 1;
      };
      const total = sec.steps * sec.bars;
      for (const ev of evs) {
        const t0 = (ev.i / total) * loopLen;
        if (reduced) {
          drawNote(ev, t0);
          continue;
        }
        const base = p?.looping || !p ? Math.floor(pos / loopLen) : 0;
        for (const k of p?.looping ? [base - 0, base + 1] : p ? [0] : [0, 1]) drawNote(ev, t0 + k * loopLen);
      }

      // קו המכה (או סרגל נע ב"פחות תנועה")
      const lineY = reduced ? yOf(p ? ((pos % loopLen) + loopLen) % loopLen : 0) : hitY;
      c.strokeStyle = '#ff2d87';
      c.lineWidth = 3;
      c.shadowColor = '#ff2d87';
      c.shadowBlur = 8;
      c.beginPath();
      c.moveTo(0, lineY);
      c.lineTo(w, lineY);
      c.stroke();
      c.shadowBlur = 0;

      // שמות המסלולים
      c.fillStyle = '#c9b48a';
      c.font = `700 ${labelH - 4}px Heebo, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      ln.forEach((id, k) => c.fillText(HAND_LABEL[id] || PIECES[id].label, k * laneW + laneW / 2, h - labelH / 2 + 1, laneW - 2));
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = posRef.current;
      const v = view.current;
      // בלי ריצה מציירים פעם אחת (ושוב רק כשהסעיף / הקצב / הגודל משתנים)
      if (!p && idleDrawn && seenSection === v.section && seenLook === v.lookahead) return;
      idleDrawn = !p;
      seenSection = v.section;
      seenLook = v.lookahead;
      draw(p);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [posRef]);

  return (
    <div ref={wrapRef} className="highway desk border-b border-black" dir="ltr" role="img" aria-label="מסלול: הנוטות יורדות אל הקו – מכים כשהן מגיעות אליו">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
