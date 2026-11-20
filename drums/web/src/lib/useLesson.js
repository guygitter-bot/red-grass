// מצב הלימוד בזמן אמת. מצבים:
//  demo     – האפליקציה מנגנת את הביט בעצמה (שומעים ורואים), מתזמנת קדימה לפי שעון האודיו
//  practice – קליק מטרונום + הדגשות; המשתמש מנגן ומקבל משוב על כל מכה
//  song     – השיר מיוטיוב מתנגן והדגשות עוקבות אחריו (זמן הסרטון פחות היסט הסנכרון)
// ההדגשות על הסט והזזת הסמן בציר הזמן נעשות ישירות ב-DOM (בלי רינדור 60 פעם בשנייה).
import { useCallback, useEffect, useRef, useState } from 'react';
import { barSeconds, candidatesAround, cueAt, loopSeconds, matchHit, scheduleFor, scorePercent, wrap } from './lesson';
import { clearCues, feedbackPad, flashEl, padEl, setCues } from './padfx';
import { audioLatency, audioTime, ensureAudio, playClick, playPiece } from './sounds';
import { createSongClock } from './songclock';

export const EMPTY_STATS = { perfect: 0, good: 0, missed: 0, wrong: 0, score: 0 };
const LOOKAHEAD = 0.15; // כמה קדימה מתזמנים אודיו (שניות)
const strengthOf = (p) => (p === 'hihat' || p === 'hihatOpen' ? 0.55 : p === 'kick' || p === 'snare' ? 0.9 : 0.8);
// עוצמת הדגמה: מכה "שקטה" בתרגיל טכניקה (אות קטנה) מנוגנת חלש
const demoVel = (section, p, index) => (section.soft?.[p]?.includes(index) ? 0.36 : strengthOf(p));

// הערות: section כבר מותאם לסט (fitSection). boxRef = אלמנט הסט, playheadRef = הסמן בציר הזמן,
// songApi = ref לנגן השיר, offset = היסט הסנכרון (שניות)
// posRef (לא חובה) = המיקום הנוכחי לתצוגת "מסלול" ({ pos, loopLen, looping }), מתעדכן בכל פריים
// onResult (לא חובה) = נקרא כשתרגול / שיר מסתיים: { mode, score, notes, seconds, speed }
export function useLesson({ section, bpm, mode, speed, loop, countIn, voice, boxRef, playheadRef, songApi, offset, posRef, onResult }) {
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [status, setStatus] = useState(''); // '' | 'paused' | 'noplayer'
  const cfg = useRef({});
  cfg.current = { loop, countIn, voice, offset, onResult };
  const run = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    const song = mode === 'song';
    const sp = song ? 1 : speed; // בשיר הזמן הוא זמן הסרטון (בקצב המקורי); הקצב משתנה דרך הנגן
    const events = scheduleFor(section, bpm, sp);
    const loopLen = loopSeconds(section, bpm, sp);
    const spb = barSeconds(bpm, sp) / 4;
    if (!events.length) {
      setRunning(false);
      return undefined;
    }
    const st = { perfect: 0, good: 0, missed: 0, wrong: 0 };
    const claimed = new Set();
    const clock = song ? createSongClock(songApi) : null;
    let origin = 0;
    let nextOrd = 0; // המכה הבאה לתזמון אודיו
    let nextBeat = 0; // הפעמה הבאה לקליק
    let flashOrd = 0; // המכה הבאה להבהוב (הדגמה)
    let evalOrd = null; // המכה הבאה לבדיקת "פספוס"
    let lastPos = null;
    let shownCount = -1;
    let lastStatus = '';
    let rateTry = 0;
    let raf = 0;
    let timer = 0;
    let done = false;
    const startedAt = performance.now();
    let reported = false;

    // מדווח על ריצה שהסתיימה (פעם אחת): ציון, כמה מכות נסגרו וכמה זמן תרגלו
    const report = () => {
      if (reported || mode === 'demo') return;
      reported = true;
      const notes = st.perfect + st.good + st.missed;
      cfg.current.onResult?.({ mode, score: scorePercent(st), notes, seconds: (performance.now() - startedAt) / 1000, speed: sp, passNotes: events.reduce((a, e) => a + e.pieces.length, 0) });
    };

    setStats({ ...EMPTY_STATS });
    setCount(0);

    if (!song) {
      if (!ensureAudio()) {
        setRunning(false);
        return undefined;
      }
      const lead = cfg.current.countIn ? 4 * spb : 0;
      origin = audioTime() + 0.12 + lead;
      for (let i = 0; i < 4 && lead > 0; i++) playClick(origin - lead + i * spb, i === 0);
    }

    // מיקום בסעיף בשניות (שלילי בספירה לאחור); null אם אין זמן (השיר מושהה / אין נגן)
    const now = () => {
      if (!song) return audioTime() - audioLatency() - origin;
      const s = clock.sample();
      if (!s) {
        if (lastStatus !== 'noplayer') setStatus((lastStatus = 'noplayer'));
        return null;
      }
      const want = s.playing ? '' : 'paused';
      if (lastStatus !== want) setStatus((lastStatus = want));
      if (!s.playing) return null;
      const api = songApi.current;
      if (api?.getRate && api.getRate() !== speed && performance.now() - rateTry > 1000) {
        rateTry = performance.now(); // לא מנסים כל פריים (אם הקצב לא זמין בסרטון)
        api.setRate?.(speed);
      }
      let p = s.time - cfg.current.offset;
      if (p < 0) p += Math.ceil(-p / loopLen) * loopLen; // לפני תחילת ההיסט – ממשיכים את הלולאה אחורה
      return p;
    };
    const looping = () => song || cfg.current.loop;
    const ordTime = (ord) => Math.floor(ord / events.length) * loopLen + events[((ord % events.length) + events.length) % events.length].time;
    const ordPass = (ord) => Math.floor(ord / events.length);

    // מכה ראשונה שמועד הבדיקה שלה עוד לא עבר
    const resync = (pos) => {
      let ord = Math.max(0, Math.floor(pos / loopLen)) * events.length;
      while (ordTime(ord) + 0.15 < pos) ord++;
      evalOrd = ord;
    };

    const publish = () => setStats({ ...st, score: scorePercent(st) });

    const tick = () => {
      if (song || done) return;
      const horizon = audioTime() + LOOKAHEAD;
      while (true) {
        const pass = ordPass(nextOrd);
        if (!cfg.current.loop && pass >= 1) break;
        const t = origin + ordTime(nextOrd);
        if (t > horizon) break;
        if (mode === 'demo') { const ev = events[nextOrd % events.length]; for (const p of ev.pieces) playPiece(p, cfg.current.voice, demoVel(section, p, ev.index), t); }
        nextOrd++;
      }
      if (mode === 'practice') {
        while (true) {
          const t = origin + nextBeat * spb;
          if (t > horizon) break;
          if (!cfg.current.loop && nextBeat >= section.bars * 4) break;
          playClick(t, nextBeat % 4 === 0);
          nextBeat++;
        }
      }
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const root = boxRef.current;
      const pos = now();
      if (pos === null) {
        clearCues(root);
        lastPos = null;
        if (posRef) posRef.current = null;
        return;
      }
      if (posRef) posRef.current = { pos, loopLen, looping: looping() };
      if (!looping() && pos > loopLen + 0.35) {
        finish();
        return;
      }
      const inLoop = pos < 0 ? pos : looping() ? wrap(pos, loopLen) : Math.min(pos, loopLen);
      if (playheadRef?.current) {
        playheadRef.current.style.left = `${(Math.max(0, inLoop) / loopLen) * 100}%`;
        playheadRef.current.style.opacity = pos < 0 ? '0' : '1';
      }
      if (pos < 0) {
        const c = Math.ceil(-pos / spb);
        if (c !== shownCount) setCount((shownCount = c));
        setCues(root, new Set(), new Set(events[0].pieces), events[0].hands);
        return;
      }
      if (shownCount !== 0) setCount((shownCount = 0));
      const c = cueAt(events, loopLen, inLoop, spb * 2);
      setCues(root, c.now, c.soon, c.hands);

      if (mode === 'demo') {
        // הבהוב החלק בשעת המכה (הצליל מתוזמן בנפרד, מראש)
        while (ordTime(flashOrd) <= pos && (looping() || ordPass(flashOrd) < 1)) {
          if (pos - ordTime(flashOrd) < 0.3) for (const p of events[flashOrd % events.length].pieces) flashEl(padEl(root, p));
          flashOrd++;
        }
        return;
      }
      // תרגול / שיר: סופרים מכות שלא נוגנו
      if (evalOrd === null || lastPos === null || pos < lastPos - 0.05 || pos - lastPos > 0.6) resync(pos);
      lastPos = pos;
      let changed = false;
      while ((looping() || ordPass(evalOrd) < 1) && ordTime(evalOrd) + 0.15 < pos) {
        const pass = ordPass(evalOrd);
        const ev = events[evalOrd % events.length];
        for (const p of ev.pieces) {
          const k = `${pass}:${ev.index}:${p}`;
          if (!claimed.has(k)) {
            claimed.add(k);
            st.missed++;
            changed = true;
          }
        }
        evalOrd++;
      }
      if (changed) publish();
    };

    function finish() {
      if (done) return;
      done = true;
      report();
      cancelAnimationFrame(raf);
      clearInterval(timer);
      clearCues(boxRef.current);
      setCount(0);
      setRunning(false);
    }

    run.current = {
      hit(id) {
        if (mode === 'demo') return;
        const pos = now();
        if (pos === null || pos < -0.25) return;
        const cands = candidatesAround(events, loopLen, pos, looping()).filter((c) => !claimed.has(`${c.key}:${id}`));
        const m = matchHit(id, pos, cands);
        if (m.grade === 'miss') {
          st.wrong++;
        } else {
          claimed.add(`${m.event.key}:${id}`);
          st[m.grade]++;
        }
        feedbackPad(boxRef.current, id, m.grade);
        publish();
      },
    };

    timer = setInterval(tick, 25);
    tick();
    raf = requestAnimationFrame(frame);
    return () => {
      report();
      done = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      clearCues(boxRef.current);
      run.current = null;
      if (posRef) posRef.current = null;
      if (song) {
        try {
          songApi.current?.setRate?.(1);
        } catch {
          // אין נגן – אין מה להחזיר
        }
      }
      if (playheadRef?.current) playheadRef.current.style.opacity = '0';
    };
    // cfg נקרא בתוך הלולאה (שינוי בלי הפעלה מחדש); השאר מפעילים מחדש את ההרצה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, section, bpm, speed]);

  const start = useCallback(() => {
    setStatus('');
    setRunning(true);
  }, []);
  const stop = useCallback(() => {
    setRunning(false);
  }, []);
  const hit = useCallback((id) => {
    run.current?.hit(id);
  }, []);

  return { running, start, stop, hit, count, stats, status };
}
