// ייבוא מערוץ טלגרם (#/admin/import): בוחרים את תיקיית הייצוא של Telegram Desktop, מסננים לפי תאריכים,
// מסמנים הודעות – וכל קוד מוצר נשמר כטיוטה מוסתרת (עם הקוד המדויק, קישור FlyLinking והתמונות).
// הכול קורה בדפדפן; לשרת נשלחות רק התמונות (מוקטנות) והמוצרים.
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, FolderOpen, Sparkles, X } from 'lucide-react';
import { shrinkImage } from '../lib/api';
import { allProducts, readExport } from '../lib/telegram';
import { Chip, Field, inputClass } from './ui';

const DAY = 24 * 60 * 60 * 1000;
const day = (d) => String(d || '').slice(0, 10);
const fileFor = (files, path) => files.get(path) || files.get(String(path).split('/').pop());

export default function ImportTelegram({ state, categories, call, onSaved }) {
  const [files, setFiles] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState({});
  const [category, setCategory] = useState('football');
  const [enrich, setEnrich] = useState(false);
  const [status, setStatus] = useState({});
  const [running, setRunning] = useState(false);

  const existing = useMemo(() => new Set(state.shirts.map((s) => s.code.toLowerCase())), [state.shirts]);

  // תמונות קטנות לרשימה (כתובות זמניות בדפדפן)
  const thumbs = useMemo(() => {
    const out = {};
    if (!files) return out;
    for (const it of items) {
      const f = fileFor(files, it.photos[0]);
      if (f && !out[it.photos[0]]) out[it.photos[0]] = URL.createObjectURL(f);
    }
    return out;
  }, [files, items]);
  useEffect(() => {
    return () => {
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [thumbs]);

  const choose = async (list) => {
    setError('');
    const map = new Map();
    let json = null;
    for (const f of list) {
      // "ChatExport_2026-10-18/photos/photo_1.jpg" -> "photos/photo_1.jpg"
      const path = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
      map.set(path, f);
      // גם לפי שם הקובץ לבד (דפדפנים שלא מוסרים את הנתיב בתוך התיקייה)
      if (!map.has(f.name)) map.set(f.name, f);
      if (f.name === 'result.json') json = f;
    }
    if (!json) return setError('לא נמצא הקובץ result.json. בוחרים את כל התיקייה שטלגרם יצר, בפורמט JSON.');
    let data;
    try {
      data = JSON.parse(await json.text());
    } catch {
      return setError('הקובץ result.json לא תקין');
    }
    const found = allProducts(readExport(data));
    if (!found.length) return setError('לא נמצאו הודעות עם קוד מוצר בייצוא');
    setFiles(map);
    setItems(found);
    setStatus({});
    setPicked(Object.fromEntries(found.map((it) => [it.key, !existing.has(it.code.toLowerCase())])));
    const dates = found.map((it) => day(it.date)).sort();
    setFrom(dates[0]);
    setTo(dates.at(-1));
  };

  const visible = items.filter((it) => (!from || day(it.date) >= from) && (!to || day(it.date) <= to));
  const chosen = visible.filter((it) => picked[it.key] && status[it.key] !== 'done');
  const template = categories.find((c) => c.id === category)?.template;

  const lastDays = (n) => {
    setTo(day(new Date().toISOString()));
    setFrom(day(new Date(Date.now() - n * DAY).toISOString()));
  };

  const run = async () => {
    setRunning(true);
    for (const it of chosen) {
      setStatus((s) => ({ ...s, [it.key]: 'busy' }));
      try {
        const images = [];
        for (const p of it.photos) {
          const f = fileFor(files, p);
          if (!f) continue;
          images.push((await call('/admin/image-upload', { data: await shrinkImage(f) })).key);
        }
        let details = {};
        if (enrich) {
          details = (await call('/admin/enrich', { category, team: it.team, type: it.type, year: it.year }).catch(() => ({ details: {} }))).details;
        }
        const res = await call('/admin/shirt', {
          ...details,
          category,
          team: details.team || it.team,
          type: it.type || details.type || '',
          year: it.year || details.year || '',
          colorHe: it.colorHe || details.colorHe || '',
          code: it.code,
          codeManual: true,
          flyLink: it.flyLink,
          longSleeve: template === 'football' && it.longSleeve,
          images,
          published: false,
        });
        onSaved(res.shirt);
        setStatus((s) => ({ ...s, [it.key]: 'done' }));
      } catch (e) {
        setStatus((s) => ({ ...s, [it.key]: e.status === 409 ? 'exists' : `error:${e.message}` }));
      }
    }
    setRunning(false);
  };

  const done = Object.values(status).filter((s) => s === 'done').length;

  return (
    <div>
      <a href="#/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:underline">
        <ArrowRight size={16} /> לכל המוצרים
      </a>
      <h1 className="mb-4 text-2xl font-black">ייבוא מערוץ טלגרם</h1>

      {!files && (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-line lg:p-5">
          <h2 className="mb-2 font-extrabold">1. ייצוא מטלגרם (במחשב)</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
            <li>פותחים את <b>Telegram Desktop</b> במחשב ונכנסים לערוץ.</li>
            <li>לוחצים על ⋮ (למעלה) ← <b>Export chat history</b> (ייצוא היסטוריית צ'אט).</li>
            <li>מסמנים <b>Photos</b> בלבד, בפורמט <b>Machine-readable JSON</b>. אפשר לבחור כבר כאן טווח תאריכים.</li>
            <li>לוחצים Export, ומחכים שטלגרם יסיים.</li>
          </ol>
          <h2 className="mb-2 mt-5 font-extrabold">2. בוחרים את התיקייה שנוצרה</h2>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-lime py-3 font-bold text-ink">
            <FolderOpen size={18} /> בחירת תיקיית הייצוא
            <input type="file" webkitdirectory="" directory="" multiple className="hidden" onChange={(e) => choose([...e.target.files])} />
          </label>
          <p className="mt-2 text-xs text-muted">עובד במחשב (Chrome / Edge). שום דבר לא נשמר עד שלוחצים "ייבוא".</p>
          {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        </section>
      )}

      {files && (
        <>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-line">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field label="מתאריך">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              </Field>
              <Field label="עד תאריך">
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              </Field>
              <Field label="קטגוריה">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end gap-2">
                <Chip small onClick={() => lastDays(7)}>שבוע</Chip>
                <Chip small onClick={() => lastDays(30)}>חודש</Chip>
                <Chip small onClick={() => { setFrom(''); setTo(''); }}>הכול</Chip>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} className="mt-1" />
              <span>
                <Sparkles size={14} className="inline text-lime-ink" /> להשלים אוטומטית שם בעברית, תיאור, ליגה ותגים{' '}
                <span className="text-muted">(כ-1–2 ₪ למוצר; אפשר גם אחר כך, מוצר-מוצר)</span>
              </span>
            </label>
          </section>

          <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              {visible.length} מוצרים בתאריכים שנבחרו · {chosen.length} מסומנים
            </span>
            <div className="flex gap-3">
              <button onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(visible.map((it) => [it.key, true])) }))} className="font-bold text-lime-ink hover:underline">
                סימון הכול
              </button>
              <button onClick={() => setPicked((p) => ({ ...p, ...Object.fromEntries(visible.map((it) => [it.key, false])) }))} className="font-bold text-muted hover:underline">
                ניקוי
              </button>
            </div>
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
            {visible.map((it) => {
              const st = status[it.key];
              const exists = existing.has(it.code.toLowerCase()) && st !== 'done';
              return (
                <label key={it.key} className="flex cursor-pointer items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(picked[it.key])}
                    disabled={running || st === 'done'}
                    onChange={(e) => setPicked((p) => ({ ...p, [it.key]: e.target.checked }))}
                    className="h-5 w-5 shrink-0"
                  />
                  {thumbs[it.photos[0]] ? (
                    <img src={thumbs[it.photos[0]]} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-soft" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div dir="ltr" className="truncate text-right font-mono text-sm font-bold">{it.code}</div>
                    <div className="truncate text-sm text-muted">{it.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-full bg-soft px-2 py-0.5">{new Date(it.date).toLocaleDateString('he-IL')}</span>
                      <span className="rounded-full bg-soft px-2 py-0.5">{it.photos.length} תמונות</span>
                      {it.longSleeve && <span className="rounded-full bg-soft px-2 py-0.5">גם שרוול ארוך</span>}
                      {!it.flyLink && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-700 dark:text-amber-300">אין קישור FlyLinking</span>}
                      {exists && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-700 dark:text-amber-300">הקוד כבר באתר</span>}
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-left text-xs">
                    {st === 'busy' && <span className="text-muted">מייבא…</span>}
                    {st === 'done' && <span className="flex items-center gap-1 font-bold text-lime-ink"><Check size={14} /> יובא</span>}
                    {st === 'exists' && <span className="text-muted">כבר קיים</span>}
                    {st?.startsWith('error:') && <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={st.slice(6)}><X size={14} /> שגיאה</span>}
                  </span>
                </label>
              );
            })}
            {!visible.length && <div className="p-8 text-center text-muted">אין מוצרים בתאריכים שנבחרו</div>}
          </div>

          <div className="sticky bottom-3 mt-4">
            <button
              onClick={run}
              disabled={running || !chosen.length}
              className="w-full rounded-full bg-ink py-3.5 font-bold text-white shadow-lg disabled:opacity-50 dark:bg-lime dark:text-ink"
            >
              {running ? `מייבא… (${done})` : `ייבוא ${chosen.length} מוצרים כטיוטות`}
            </button>
          </div>
          {done > 0 && !running && (
            <p className="mt-3 rounded-xl bg-lime/20 p-3 text-sm">
              יובאו {done} טיוטות מוסתרות. עוברים עליהן ברשימה (סינון "מוסתרים"), משלימים מה שחסר ומפרסמים.
            </p>
          )}
        </>
      )}
    </div>
  );
}
