import { useEffect, useState } from 'react';
import Compare from './Compare';
import { getIdeas, render } from '../lib/api';
import { dataUrl, download, makeThumb, share } from '../lib/image';
import { addVersion, getImage, newId, removeProject, removeVersion, saveProject } from '../lib/store';
import { COLORS, QUICK, STYLES, addToRequest, colorText, shortTitle, styleText } from '../lib/design';

// חדר אחד: התמונה (עם השוואת לפני/אחרי), הגרסאות, הבקשה לשינוי וההצעות מהמעצב
export default function Project({ project, onChange, onBack }) {
  const [images, setImages] = useState({}); // מזהה -> { media_type, data }
  const [sel, setSel] = useState(project.versions[project.versions.length - 1]?.id || project.id);
  const [request, setRequest] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(''); // 'render' | 'ideas' | ''
  const [error, setError] = useState('');
  const [name, setName] = useState(project.name);

  // טוען את הצילום המקורי ואת הגרסה שמוצגת (רק מה שעוד לא נטען)
  useEffect(() => {
    let alive = true;
    for (const key of [project.id, sel]) {
      if (images[key]) continue;
      getImage(key).then((im) => {
        if (alive && im) setImages((cur) => ({ ...cur, [key]: im }));
      });
    }
    return () => {
      alive = false;
    };
  }, [project.id, sel, images]);

  const original = images[project.id];
  const shown = images[sel];
  const version = project.versions.find((v) => v.id === sel);
  const ratio = project.w && project.h ? `${project.w} / ${project.h}` : '4 / 3';

  // יוצר הדמיה מתמונת בסיס: הבקשה החופשית עובדת על התמונה שמוצגת, הצעה של המעצב – תמיד על הצילום המקורי
  async function make(base, req, label, title = '') {
    if (!req || !base || busy) return;
    setBusy('render');
    setError('');
    try {
      const image = await render(base, req);
      const v = { id: newId(), request: label, title, thumb: await makeThumb(image), createdAt: Date.now() };
      await addVersion({ ...project, versions: [...project.versions, v] }, v, image);
      setImages((cur) => ({ ...cur, [v.id]: image }));
      setSel(v.id);
      if (!title) setRequest('');
      await onChange();
    } catch (e) {
      setError(e?.message || 'משהו השתבש. נסו שוב.');
    } finally {
      setBusy('');
    }
  }

  async function askDesigner() {
    if (!original || busy) return;
    setBusy('ideas');
    setError('');
    try {
      const { room, ideas } = await getIdeas(original, note.trim());
      await saveProject({ ...project, room, ideas });
      await onChange();
    } catch (e) {
      setError(e?.message || 'משהו השתבש. נסו שוב.');
    } finally {
      setBusy('');
    }
  }

  async function deleteVersion() {
    if (!version || !window.confirm('למחוק את ההדמיה הזאת?')) return;
    const versions = project.versions.filter((v) => v.id !== version.id);
    await removeVersion({ ...project, versions }, version.id);
    setSel(versions[versions.length - 1]?.id || project.id);
    await onChange();
  }

  async function deleteProject() {
    if (!window.confirm('למחוק את החדר הזה עם כל ההדמיות שלו?')) return;
    await removeProject(project);
    onBack();
  }

  async function rename() {
    const next = name.trim();
    if (!next || next === project.name) { setName(project.name); return; }
    await saveProject({ ...project, name: next });
    await onChange();
  }

  const fileName = `${project.name || 'חדר'}${version ? ` - ${shortTitle(version.title || version.request, 20)}` : ''}`;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-4">
      <header className="mb-4 flex items-center gap-2">
        <button className="btn px-3" onClick={onBack} aria-label="חזרה לרשימת החדרים">→</button>
        <input className="field min-w-0 flex-1 font-bold" value={name} aria-label="שם החדר" onChange={(e) => setName(e.target.value)} onBlur={rename} />
        <button className="btn px-3" onClick={deleteProject} aria-label="מחיקת החדר">🗑️</button>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">
        <section className="lg:sticky lg:top-4">
          <div className="relative">
            {version && original && shown ? (
              <Compare before={dataUrl(original)} after={dataUrl(shown)} ratio={ratio} />
            ) : (
              <div className="overflow-hidden rounded-2xl bg-soft" style={{ aspectRatio: ratio }}>
                {shown && <img src={dataUrl(shown)} alt="הצילום המקורי" className="h-full w-full object-cover" />}
              </div>
            )}
            {busy === 'render' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/60 p-4 text-center text-white" role="status">
                <span className="spinner" />
                <span>המעצב מצייר את ההדמיה… זה לוקח כחצי דקה</span>
              </div>
            )}
          </div>

          {version && <p className="m-0 mt-2 text-sm text-muted">{version.request}</p>}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="הגרסאות">
            <Thumb label="מקור" src={project.thumb} active={sel === project.id} onClick={() => setSel(project.id)} />
            {project.versions.map((v, i) => (
              <Thumb key={v.id} label={String(i + 1)} src={v.thumb} active={sel === v.id} onClick={() => setSel(v.id)} />
            ))}
          </div>

          {version && shown && (
            <div className="mt-1 flex flex-wrap gap-2">
              <button className="btn flex-1" onClick={() => share(shown, fileName)}>שיתוף</button>
              <button className="btn flex-1" onClick={() => download(shown, fileName)}>הורדה</button>
              <button className="btn" onClick={deleteVersion} aria-label="מחיקת ההדמיה">🗑️</button>
            </div>
          )}
        </section>

        <section className="mt-6 flex flex-col gap-4 lg:mt-0">
          {error && <p className="m-0 rounded-xl bg-bad-soft p-3 text-sm text-bad" role="alert">{error}</p>}

          <div className="rounded-2xl border border-line bg-card p-4">
            <h2 className="m-0 text-lg font-bold">מה לשנות?</h2>
            <p className="m-0 mb-3 text-sm text-muted">
              {version ? 'השינוי ייעשה על ההדמיה שמוצגת. כדי להתחיל מהצילום – לבחור "מקור".' : 'כותבים חופשי, או בוחרים מהקיצורים למטה.'}
            </p>
            <textarea
              className="field" rows={3} value={request} onChange={(e) => setRequest(e.target.value)}
              placeholder="לדוגמה: לחפות את הקיר שמאחורי הספה בעץ, ולתלות מעליה שלוש תמונות"
            />
            <button className="btn btn-main mt-3 w-full" disabled={!request.trim() || !shown || Boolean(busy)} onClick={() => make(shown, request.trim(), request.trim())}>
              ✨ ליצור הדמיה
            </button>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-muted">שינויים נפוצים</h3>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q.label} className="chip" onClick={() => setRequest((r) => addToRequest(r, q.text))}>{q.label}</button>
              ))}
            </div>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-muted">צבע לקיר</h3>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.hex} title={c.name} aria-label={c.name}
                  className="h-10 w-10 rounded-full border border-line"
                  style={{ background: c.hex }}
                  onClick={() => setRequest((r) => addToRequest(r, colorText(c)))}
                />
              ))}
            </div>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-muted">סגנון לכל החדר</h3>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button key={s} className="chip" onClick={() => setRequest((r) => addToRequest(r, styleText(s)))}>{s}</button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <h2 className="m-0 text-lg font-bold">הצעות מהמעצב</h2>
            <p className="m-0 mb-3 text-sm text-muted">המעצב מסתכל על הצילום ומציע כמה כיוונים שמתאימים לחדר הזה.</p>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה חשוב לך? (לא חובה) – למשל: חמים, בלי שיפוץ גדול" />
            <button className="btn mt-3 w-full" disabled={!original || Boolean(busy)} onClick={askDesigner}>
              {busy === 'ideas' ? 'המעצב מסתכל על החדר…' : project.ideas.length ? 'הצעות חדשות' : '💡 תן לי רעיונות'}
            </button>

            {project.room && <p className="mb-0 mt-4 rounded-xl bg-soft p-3 text-sm">{project.room}</p>}
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {project.ideas.map((idea) => (
                <li key={idea.title} className="rounded-xl border border-line p-3">
                  <strong className="block">{idea.title}</strong>
                  <span className="block text-sm text-muted">{idea.why}</span>
                  <button className="btn mt-2 w-full" disabled={!original || Boolean(busy)} onClick={() => make(original, idea.prompt, `${idea.title}: ${idea.why}`, idea.title)}>
                    להראות לי את זה
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function Thumb({ label, src, active, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`relative shrink-0 overflow-hidden rounded-xl border-2 p-0 ${active ? 'border-accent' : 'border-line'}`}>
      <img src={src} alt="" className="block h-16 w-20 object-cover" />
      <span className="absolute bottom-0 right-0 rounded-tl-lg bg-black/60 px-2 text-xs text-white">{label}</span>
    </button>
  );
}
