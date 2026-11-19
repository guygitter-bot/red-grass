import { useRef, useState } from 'react';
import { KINDS, LOOKS, ASPECTS, STYLES, MAX_IMAGES, defaultStyle } from '../lib/brief';
import { fileToImage, makeThumb } from '../lib/image';
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

// תמונה אחת ברשימה: ממוזערת, עם בחירה אם זה צילום או שרטוט, והסרה
function Tile({ item, index, onKind, onRemove }) {
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="relative">
        <img src={item.thumb} alt={`תמונה ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
        <span className="absolute start-1 top-1 rounded-full bg-black/70 px-2 text-xs text-white">{index + 1}</span>
        <button type="button" aria-label={`להסיר את תמונה ${index + 1}`} className="absolute end-1 top-1 h-8 w-8 rounded-full bg-black/70 text-white" onClick={onRemove}>✕</button>
      </div>
      <div className="flex gap-1 p-1">
        {[['photo', 'צילום'], ['plan', 'שרטוט']].map(([id, label]) => (
          <button key={id} type="button" className="chip flex-1 !min-h-9 !px-1 text-center" aria-pressed={item.kind === id} onClick={() => onKind(id)}>{label}</button>
        ))}
      </div>
    </li>
  );
}

const toOptions = (map) => Object.entries(map).map(([id, v]) => ({ id, ...v }));

// טופס "סרטון חדש": מה מצלמים, התמונות, האור והפורמט
export default function NewFilm({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('building');
  const [look, setLook] = useState('golden');
  const [style, setStyle] = useState(''); // ריק = לפי מה שמצלמים
  const chosenStyle = style || defaultStyle(kind);
  const [aspect, setAspect] = useState('16:9');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]); // [{ key, kind, im, thumb }] לפי הסדר
  const counter = useRef(0);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // כמה קבצים בבת אחת, אחד אחרי השני (כדי לא להעמיס על הזיכרון בטלפון). עד MAX_IMAGES
  const pick = async (files) => {
    const room = MAX_IMAGES - images.length;
    const list = [...files].slice(0, Math.max(0, room));
    if (!list.length) return;
    setBusy('add');
    setError(files.length > room ? `אפשר עד ${MAX_IMAGES} תמונות. ${room > 0 ? `נוספו ${room} הראשונות.` : ''}` : '');
    const added = [];
    try {
      for (const [i, file] of list.entries()) {
        setProgress(list.length > 1 ? `${i + 1} מתוך ${list.length}` : '');
        const im = await fileToImage(file);
        added.push({ key: `i${++counter.current}`, kind: 'photo', im, thumb: await makeThumb(im) });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setImages((prev) => [...prev, ...added]);
      setBusy('');
      setProgress('');
    }
  };
  const setImageKind = (key, k) => setImages((prev) => prev.map((x) => (x.key === key ? { ...x, kind: k } : x)));
  const remove = (key) => setImages((prev) => prev.filter((x) => x.key !== key));

  const create = async (e) => {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      const id = newId();
      const project = safeProject({
        id, name: name.trim(), createdAt: Date.now(), thumb: (images.find((x) => x.kind === 'photo') || images[0]).thumb,
        brief: { kind, look, aspect, style: chosenStyle, note: note.trim() }, images: images.map(({ key, kind: k }) => ({ key, kind: k })),
      });
      await createProject(project, Object.fromEntries(images.map((x) => [x.key, x.im])));
      onCreated(id);
    } catch (err) {
      setError(err.message || 'לא הצלחנו לשמור. נסו שוב.');
      setBusy('');
    }
  };

  const ready = images.length > 0;

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
          <span className="label">התמונות ({images.length} מתוך {MAX_IMAGES})</span>
          <p className="mb-2 text-sm text-muted">
            אפשר להעלות עד {MAX_IMAGES}: חזיתות, חדרים, זוויות שונות ושרטוטים. הבמאי מסתכל על כולן ובונה כל שוט מהתמונה שמתאימה לו – ככל שיש יותר תמונות, יש יותר שוטים (עד 8).
            שרטוט? סמנו אותו "שרטוט".
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((item, i) => (
              <Tile key={item.key} item={item} index={i} onKind={(k) => setImageKind(item.key, k)} onRemove={() => remove(item.key)} />
            ))}
            {images.length < MAX_IMAGES && (
              <li>
                <label className="flex aspect-[4/3] min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-card p-2 text-center">
                  {busy === 'add' ? <span className="spinner" /> : <span className="text-3xl" aria-hidden="true">＋</span>}
                  <span className="font-semibold">{images.length ? 'עוד תמונות' : 'להעלות תמונות'}</span>
                  <span className="text-xs text-muted">{busy === 'add' && progress ? progress : 'אפשר לבחור כמה ביחד'}</span>
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={busy === 'add'}
                    onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; if (f.length) pick(f); }} />
                </label>
              </li>
            )}
          </ul>
          <p className="mt-2 text-sm text-muted">תוכנית ב-PDF? צלמו מסך והעלו את התמונה.</p>
        </div>

        <Choice label="סגנון הסרטון" options={STYLES} value={chosenStyle} onChange={setStyle} />
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
