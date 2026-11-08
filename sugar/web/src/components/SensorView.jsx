// החיישן: תמונה אחת של החיישן הנוכחי (המדבקה עם הפרטים), כדי לראות את הפרטים כשצריך.
// כל העלאה מחליפה את התמונה הקודמת. התמונה משותפת לכל מי שמשתמש ביומן.
// תאריך החלפת החיישן – נקבע להיום כשמעלים תמונה, ואפשר לשנות (גם לאחור).
import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { getSensorPhoto, shrinkImage, uploadSensorPhoto } from '../lib/photo';
import { save, sync } from '../lib/store';
import { addDays, today } from '../lib/diary';
import { getMe } from '../lib/me';
import { Button, Field, inputCls } from './ui';

const when = (at) => new Date(at).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SensorView({ data }) {
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [big, setBig] = useState(false);
  const at = data.sensor?.at || 0;
  const changed = data.sensor?.changed || '';
  let daysAgo = 0;
  if (changed) while (daysAgo < 400 && addDays(changed, daysAgo) < today()) daysAgo++;

  useEffect(() => {
    let alive = true;
    if (!at) {
      setPhoto({ data: '' });
      return () => {
        alive = false;
      };
    }
    getSensorPhoto(at)
      .then((p) => {
        if (alive) setPhoto(p);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [at]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photo?.data && !confirm('להחליף את התמונה הקודמת בתמונה החדשה?')) return;
    setError('');
    try {
      setBusy('מכין את התמונה…');
      const img = await shrinkImage(file);
      setBusy('מעלה…');
      setPhoto(await uploadSensorPhoto(img, getMe()));
      sync();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">החיישן</h1>
      <p className="mb-4 text-sm text-muted">תמונה של החיישן הנוכחי והפרטים שלו. כל תמונה חדשה מחליפה את הקודמת.</p>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:flex">
        <Button onClick={() => camRef.current?.click()} disabled={!!busy} className="flex items-center justify-center gap-2">
          <Camera size={20} /> {busy || 'לצלם עכשיו'}
        </Button>
        <Button kind="ghost" onClick={() => galRef.current?.click()} disabled={!!busy} className="flex items-center justify-center gap-2">
          <ImageIcon size={20} /> מהגלריה
        </Button>
      </div>
      {/* capture – פותח ישר את המצלמה האחורית בטלפון; בלי – בחירה מהגלריה */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={pick} />

      <section className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
        <Field label="תאריך החלפת החיישן" hint={changed ? `${daysAgo === 0 ? 'הוחלף היום' : daysAgo === 1 ? 'הוחלף אתמול' : `הוחלף לפני ${daysAgo} ימים`}` : 'נקבע לבד כשמעלים תמונה – ואפשר לשנות, גם לתאריך קודם'}>
          <input
            type="date"
            className={`${inputCls} num`}
            value={changed}
            max={today()}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) save({ id: 'sensor', t: 'sensor', changed: e.target.value });
            }}
          />
        </Field>
      </section>
      {error && <p className="mb-4 rounded-xl bg-low/15 p-3 text-sm text-low">{error}</p>}

      <section className="rounded-2xl bg-card p-3 shadow-sm">
        {!photo ? (
          <p className="p-6 text-center text-sm text-muted">טוען…</p>
        ) : photo.data ? (
          <>
            <button onClick={() => setBig(true)} className="block w-full" aria-label="הגדלת התמונה">
              <img src={photo.data} alt="החיישן הנוכחי" className="mx-auto max-h-[70dvh] w-auto rounded-xl" />
            </button>
            <p className="mt-2 text-center text-sm text-muted">
              הועלתה {when(photo.at)}
              {photo.by && ` · ${photo.by}`} · לחיצה מגדילה
            </p>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-muted">עוד אין תמונה. מצלמים את החיישן החדש ואת המדבקה עם הפרטים.</p>
        )}
      </section>

      {big && photo?.data && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black" onClick={() => setBig(false)}>
          <button className="fixed top-3 left-3 z-10 rounded-full bg-black/60 p-2 text-white" aria-label="סגירה">
            <X size={24} />
          </button>
          <img src={photo.data} alt="החיישן הנוכחי – גדול" className="min-w-full" />
        </div>
      )}
    </div>
  );
}
