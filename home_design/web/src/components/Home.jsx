import { useRef, useState } from 'react';
import { fileToImage, makeThumb } from '../lib/image';
import { createProject, newId } from '../lib/store';
import { defaultName } from '../lib/design';

// מסך הפתיחה: צילום חדש + החדרים שכבר צולמו
export default function Home({ projects, error, onOpen, onCreated }) {
  const camera = useRef(null);
  const gallery = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setProblem('');
    try {
      const { w, h, ...image } = await fileToImage(file);
      const project = { id: newId(), name: defaultName(), createdAt: Date.now(), thumb: await makeThumb(image), w, h, room: '', ideas: [], versions: [] };
      await createProject(project, image);
      onCreated(project.id);
    } catch (err) {
      setProblem(err?.message || 'לא הצלחנו לקרוא את התמונה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-6 lg:pt-10">
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-bold lg:text-3xl">מעצב הבית</h1>
        <p className="m-0 mt-1 text-muted">מצלמים קיר או חדר, מבקשים שינוי, ורואים איך זה ייראה.</p>
      </header>

      <section className="rounded-2xl border border-line bg-card p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="btn btn-main flex-1" disabled={busy} onClick={() => camera.current?.click()}>📷 לצלם עכשיו</button>
          <button className="btn flex-1" disabled={busy} onClick={() => gallery.current?.click()}>🖼️ לבחור תמונה</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />
        <p className="m-0 mt-3 text-sm text-muted">טיפ: לצלם ישר מול הקיר, באור יום, כשכל הקיר נכנס בתמונה.</p>
        {busy && <p className="m-0 mt-2 text-sm">מכין את התמונה…</p>}
        {(problem || error) && <p className="m-0 mt-3 rounded-xl bg-bad-soft p-3 text-sm text-bad">{problem || error}</p>}
      </section>

      <h2 className="mb-3 mt-8 text-lg font-bold">החדרים שלי</h2>
      {projects === null && <p className="text-muted">טוען…</p>}
      {projects?.length === 0 && <p className="text-muted">עוד אין כאן כלום. מתחילים בצילום הראשון.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {projects?.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)} className="overflow-hidden rounded-2xl border border-line bg-card p-0 text-start">
            <img src={p.versions[p.versions.length - 1]?.thumb || p.thumb} alt="" loading="lazy" className="block aspect-[4/3] w-full object-cover" />
            <span className="block px-3 py-2">
              <span className="block font-semibold">{p.name || 'חדר'}</span>
              <span className="block text-sm text-muted">{p.versions.length ? `${p.versions.length} הדמיות` : 'עוד בלי הדמיות'}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
