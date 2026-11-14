import { useState } from 'react';
import { KINDS, LOOKS, ASPECTS } from '../lib/brief';
import { fileToImage, makeThumb, dataUrl } from '../lib/image';
import { createProject, newId, safeProject } from '../lib/store';

// כפתורי בחירה (אחד מתוך כמה)
function Choice({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            <span className="block font-semibold">{o.label}</span>
            <span className="block text-xs text-muted">{o.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// משבצת להעלאת תמונה אחת
function Upload({ title, hint, image, onPick, onClear, busy }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-3">
      {image ? (
        <div>
          <img src={dataUrl(image)} alt={title} className="max-h-56 w-full rounded-xl object-contain" />
          <button type="button" className="mt-2 text-sm text-muted underline" onClick={onClear}>להסיר</button>
        </div>
      ) : (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1 text-center">
          {busy ? <span className="spinner" /> : <span className="text-3xl" aria-hidden="true">＋</span>}
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted">{hint}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }} />
        </label>
      )}
    </div>
  );
}

const toOptions = (map) => Object.entries(map).map(([id, v]) => ({ id, ...v }));

// טופס "סרטון חדש": מה מצלמים, התמונות, האור והפורמט
export default function NewFilm({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('building');
  const [look, setLook] = useState('golden');
  const [aspect, setAspect] = useState('16:9');
  const [note, setNote] = useState('');
  const [images, setImages] = useState({ photo: null, plan: null });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const pick = async (slot, file) => {
    setBusy(slot);
    setError('');
    try {
      const im = await fileToImage(file);
      setImages((prev) => ({ ...prev, [slot]: im }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      const id = newId();
      const project = safeProject({
        id, name: name.trim(), createdAt: Date.now(), thumb: await makeThumb(images.photo || images.plan),
        brief: { kind, look, aspect, note: note.trim() }, has: { photo: Boolean(images.photo), plan: Boolean(images.plan) },
      });
      await createProject(project, images);
      onCreated(id);
    } catch (err) {
      setError(err.message || 'לא הצלחנו לשמור. נסו שוב.');
      setBusy('');
    }
  };

  const ready = images.photo || images.plan;

  return (
    <main className="mx-auto max-w-3xl p-4 pb-24 lg:p-8">
      <button className="text-muted underline" onClick={onBack}>→ חזרה</button>
      <h1 className="mt-2 text-2xl font-bold">סרטון חדש</h1>

      <form onSubmit={create} className="mt-5 space-y-6">
        <div>
          <label className="label" htmlFor="name">שם הפרויקט</label>
          <input id="name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="למשל: מגדלי הים, רחוב הרצל 12" />
        </div>

        <Choice label="מה מצלמים?" options={toOptions(KINDS)} value={kind} onChange={setKind} />

        <div>
          <span className="label">התמונות (אחת מספיקה, שתיהן – עוד יותר טוב)</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <Upload title="צילום או הדמיה" hint="תמונה של הבניין / הדירה" image={images.photo} busy={busy === 'photo'}
              onPick={(f) => pick('photo', f)} onClear={() => setImages((p) => ({ ...p, photo: null }))} />
            <Upload title="שרטוט" hint="חזית, סקיצה או תוכנית דירה" image={images.plan} busy={busy === 'plan'}
              onPick={(f) => pick('plan', f)} onClear={() => setImages((p) => ({ ...p, plan: null }))} />
          </div>
          <p className="mt-2 text-sm text-muted">תוכנית ב-PDF? צלמו מסך והעלו את התמונה.</p>
        </div>

        <Choice label="האור והאווירה" options={toOptions(LOOKS)} value={look} onChange={setLook} />
        <Choice label="הפורמט" options={ASPECTS} value={aspect} onChange={setAspect} />

        <div>
          <label className="label" htmlFor="note">משהו שחשוב להדגיש? (לא חובה)</label>
          <textarea id="note" className="field" rows={3} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="למשל: נוף לים מהמרפסות, לובי מפואר, גינה עם בריכה" />
        </div>

        {error && <p role="alert" className="rounded-xl bg-bad-soft p-3 text-bad">{error}</p>}

        <button className="btn btn-main w-full text-lg" disabled={!ready || Boolean(busy)}>
          {busy === 'save' ? <span className="spinner" /> : 'לתכנן את הסרטון'}
        </button>
        {!ready && <p className="text-center text-sm text-muted">צריך להעלות לפחות תמונה אחת</p>}
      </form>
    </main>
  );
}
