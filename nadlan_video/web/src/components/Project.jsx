import { useEffect, useRef, useState } from 'react';
import Shot from './Shot';
import Film from './Film';
import { planFilm } from '../lib/api';
import { QUALITIES, STYLES } from '../lib/brief';
import { getMedia, saveProject, newId, safeShot } from '../lib/store';
import { produceStill, produceClip, readyCount } from '../lib/shots';

// סרטון אחד: התכנון של הבמאי, השוטים (פריים -> סרטון), הכותרות והסרט המלא
export default function Project({ initial, onBack }) {
  const [project, setProject] = useState(initial);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({}); // מזהה שוט -> 'still' / 'clip' (מה רץ עכשיו)
  const ref = useRef(initial); // הגרסה העדכנית, גם בתוך פעולות ארוכות
  const running = useRef(new Set());
  const alive = useRef(true);
  const started = useRef(false);

  const update = async (fn) => {
    const next = fn(ref.current);
    ref.current = next;
    setProject(next);
    await saveProject(next);
  };
  const patchShot = (id) => (patch) => update((p) => ({ ...p, shots: p.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const getShot = (id) => ref.current.shots.find((s) => s.id === id);
  const mark = (id, what) => setBusy((b) => {
    const next = { ...b };
    if (what) next[id] = what;
    else delete next[id];
    return next;
  });

  // הבמאי מתכנן את השוטים
  const plan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const p = ref.current;
      const [photo, drawing] = await Promise.all([p.has.photo ? getMedia(`${p.id}:photo`) : null, p.has.plan ? getMedia(`${p.id}:plan`) : null]);
      const out = await planFilm({ ...p.brief, name: p.name }, photo || undefined, drawing || undefined);
      await update((cur) => ({ ...cur, summary: out.summary || '', shots: out.shots.map((s) => safeShot({ ...s, id: newId() })) }));
    } catch (e) {
      setError(e);
    } finally {
      setPlanning(false);
    }
  };

  // what: 'still' = רק הפריים, 'clip' = רק הסרטון, 'all' = מה שחסר
  const run = async (id, what) => {
    if (running.current.has(id)) return;
    running.current.add(id);
    const patch = patchShot(id);
    try {
      await patch({ error: '', detail: '' });
      if (what !== 'clip' && getShot(id).still && !getShot(id).hasStill) {
        mark(id, 'still');
        await produceStill(ref.current, getShot(id), patch);
      }
      if (what !== 'still' && !getShot(id).hasClip) {
        mark(id, 'clip');
        await produceClip(ref.current, getShot(id), patch, () => alive.current);
      }
    } catch (e) {
      await patch({ error: e.message || 'משהו השתבש. נסו שוב.', detail: e.detail || '' });
    } finally {
      running.current.delete(id);
      mark(id, null);
    }
  };

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      if (!ref.current.shots.length) plan();
      // סרטונים שהתחילו להיווצר לפני שהאפליקציה נסגרה – ממשיכים לחכות להם
      for (const s of ref.current.shots) if (s.op && !s.hasClip) run(s.id, 'clip');
    }
    return () => {
      alive.current = false;
    };
  }, []);

  const redoStill = async (id) => {
    await patchShot(id)({ hasStill: false });
    run(id, 'still');
  };
  const redoClip = async (id) => {
    if (!window.confirm('ליצור את הסרטון של השוט הזה מחדש? הסרטון הקיים יוחלף.')) return;
    await patchShot(id)({ hasClip: false, op: '', opAt: 0 });
    run(id, 'clip');
  };
  const hasWork = () => ref.current.shots.some((s) => s.hasClip || s.hasStill || s.op);
  const replan = () => {
    if (hasWork() && !window.confirm('לתכנן מחדש? השוטים שכבר נוצרו יוחלפו.')) return;
    plan();
  };
  // סגנון אחר = תכנון חדש של כל השוטים
  const restyle = async (id) => {
    if (id === ref.current.brief.style) return;
    if (hasWork() && !window.confirm('להחליף סגנון? הבמאי יתכנן שוטים חדשים, והשוטים שכבר נוצרו יוחלפו.')) return;
    await update((p) => ({ ...p, brief: { ...p.brief, style: id } }));
    plan();
  };

  const missing = project.shots.filter((s) => !s.hasClip);
  const anyBusy = Object.keys(busy).length > 0;
  const ready = readyCount(project);
  const set = (field) => (e) => update((p) => ({ ...p, [field]: e.target.value }));

  return (
    <main className="mx-auto max-w-6xl p-4 pb-24 lg:p-8">
      <button className="text-muted underline" onClick={onBack}>→ כל הסרטונים</button>
      <h1 className="mt-2 text-2xl font-bold">{project.name || 'סרטון בלי שם'}</h1>
      {project.summary && <p className="mt-1 text-muted">{project.summary}</p>}

      {planning && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-card p-5">
          <span className="spinner" />
          <span>הבמאי מסתכל על התמונות ומתכנן את השוטים… (עד דקה)</span>
        </div>
      )}
      {error && (
        <div role="alert" className="mt-6 rounded-2xl bg-bad-soft p-4 text-bad">
          <p>{error.message}</p>
          {error.detail && <p dir="ltr" className="mt-1 text-xs opacity-80">{error.detail}</p>}
          <button className="btn mt-3" onClick={plan}>לנסות שוב</button>
        </div>
      )}

      {project.shots.length > 0 && (
        <>
          <section className="mt-6 rounded-2xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <fieldset>
                <legend className="label">איכות הסרטונים</legend>
                <div className="flex flex-wrap gap-2">
                  {QUALITIES.map((q) => (
                    <button key={q.id} type="button" className="chip" aria-pressed={project.quality === q.id} onClick={() => update((p) => ({ ...p, quality: q.id }))}>
                      <span className="block font-semibold">{q.label}</span>
                      <span className="block text-xs text-muted">{q.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {missing.length > 0 && (
                <button className="btn btn-main" disabled={anyBusy} onClick={() => missing.forEach((s) => run(s.id, 'all'))}>
                  להפיק את כל השוטים ({missing.length})
                </button>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">
              יצירת סרטון עולה כסף אצל Google ולוקחת כמה דקות – לכן כדאי קודם להכין את הפריים של כל שוט, לוודא שהוא נאמן לבניין, ורק אז להפוך אותו לסרטון.
            </p>
          </section>

          <ol className="mt-4 grid gap-4 lg:grid-cols-2">
            {project.shots.map((s, i) => (
              <Shot key={s.id} index={i} shot={s} project={project} busy={busy[s.id]}
                onStill={() => run(s.id, 'still')} onClip={() => run(s.id, 'clip')} onRedoStill={() => redoStill(s.id)} onRedoClip={() => redoClip(s.id)}
                onExtra={(extra) => patchShot(s.id)({ extra })} />
            ))}
          </ol>

          <section className="mt-6 rounded-2xl border border-line bg-card p-4">
            <h2 className="text-lg font-bold">הכותרות בסרט</h2>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div>
                <label className="label" htmlFor="f-name">שם הפרויקט (בפתיחה ובסיום)</label>
                <input id="f-name" className="field" maxLength={80} value={project.name} onChange={set('name')} />
              </div>
              <div>
                <label className="label" htmlFor="f-tagline">משפט מתחת לשם</label>
                <input id="f-tagline" className="field" maxLength={90} value={project.tagline} onChange={set('tagline')} placeholder="למשל: לגור מול הים" />
              </div>
              <div>
                <label className="label" htmlFor="f-contact">פרטי קשר (בסיום)</label>
                <input id="f-contact" className="field" maxLength={90} value={project.contact} onChange={set('contact')} placeholder="למשל: משרד המכירות 03-1234567" />
              </div>
            </div>
          </section>

          {ready > 0 && <Film project={project} />}

          <section className="mt-6 rounded-2xl border border-line bg-card p-4">
            <fieldset disabled={planning || anyBusy}>
              <legend className="text-lg font-bold">סגנון הסרטון</legend>
              <p className="text-sm text-muted">משעמם? בחרו סגנון אחר, והבמאי יתכנן את השוטים מחדש.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {STYLES.map((o) => (
                  <button key={o.id} type="button" className="chip" aria-pressed={project.brief.style === o.id} onClick={() => restyle(o.id)}>
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="mt-3 text-sm text-muted underline" disabled={planning || anyBusy} onClick={replan}>אותו סגנון, תכנון אחר</button>
          </section>
        </>
      )}
    </main>
  );
}
