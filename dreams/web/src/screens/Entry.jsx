import { useState } from 'react';
import Layout from '../components/Layout';
import DreamForm from '../components/DreamForm';
import LensSection from '../components/LensSection';
import { useApp } from '../context';
import { nightLabel } from '../lib/night';
import { kindById } from '../lib/kinds';
import { MOODS } from '../lib/store';

// חלום אחד מהיומן: קריאה, עריכה ומחיקה
export default function Entry({ param }) {
  const { data, update, setToast } = useApp();
  const e = data.entries.find((x) => x.id === param);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!e) {
    return (
      <Layout title="יומן" back="#/journal">
        <p>החלום הזה לא נמצא ביומן. <a href="#/journal" className="text-accent">חזרה ליומן</a></p>
      </Layout>
    );
  }
  const intention = data.nights[e.night] || null;

  if (edit) {
    return (
      <Layout title="עריכה" back={`#/entry/${e.id}`}>
        <div className="max-w-2xl mx-auto">
          <DreamForm
            initial={e.type === 'none' ? { ...e, type: 'dream' } : e}
            intention={intention}
            saveLabel="לשמור שינויים"
            onSave={(f) => {
              update((d) => ({ ...d, entries: d.entries.map((x) => (x.id === e.id ? { ...x, ...f } : x)) }));
              setToast('נשמר');
              setEdit(false);
            }}
          />
        </div>
      </Layout>
    );
  }

  const rel = { yes: 'קשור לכוונה', partly: 'קשור חלקית לכוונה', no: 'לא קשור לכוונה' }[e.related];
  return (
    <Layout title={nightLabel(e.night)} back="#/journal">
      <article className="max-w-2xl mx-auto">
        {intention && (
          <p className="text-sm text-muted mt-0">
            <span aria-hidden="true">{kindById(intention.kind).icon}</span> הכוונה: {intention.text || kindById(intention.kind).name}
            {rel && <span className="text-dawn"> · {rel}</span>}
          </p>
        )}
        <h2 className="serif text-3xl font-bold mt-1 mb-3">{e.title || (e.type === 'none' ? 'לילה בלי חלום שנזכר' : e.type === 'nap' ? 'תנומת אדיסון' : 'חלום')}</h2>
        <div className="flex flex-wrap gap-2 text-sm mb-4">
          {e.mood !== null && <span className="chip !min-h-8">{MOODS[e.mood]}</span>}
          {e.clarity && <span className="chip !min-h-8">בהירות {e.clarity}/5</span>}
          {e.lucid && <span className="chip !min-h-8 text-accent">חלום צלול</span>}
          {e.tags.map((t) => (
            <a key={t} href={`#/journal/${encodeURIComponent(t)}`} className="chip !min-h-8 no-underline text-inherit">{t}</a>
          ))}
        </div>
        {e.glimpses.length > 0 && (
          <section className="mb-5">
            <h3 className="font-bold m-0 mb-2">מה עלה בתנומה</h3>
            <ol className="m-0 ps-5 grid gap-2">
              {e.glimpses.map((g, i) => (
                <li key={i} className="serif text-lg">{g}</li>
              ))}
            </ol>
          </section>
        )}
        {e.text && <div className="serif text-lg leading-loose whitespace-pre-wrap">{e.text}</div>}
        {e.answer && (
          <section className="sheet bg-dawn-soft p-4 mt-5">
            <h3 className="font-bold m-0 mb-1">מה החלום אומר על השאלה</h3>
            <p className="m-0 whitespace-pre-wrap">{e.answer}</p>
          </section>
        )}
        {e.type !== 'none' && (
          <LensSection
            key={e.id}
            entry={e}
            intention={intention}
            settings={data.settings}
            onSave={(lensId, notes) => {
              update((d) => ({
                ...d,
                entries: d.entries.map((x) => {
                  if (x.id !== e.id) return x;
                  const next = { ...(x.lensNotes || {}) };
                  if (notes.some((n) => n.trim())) next[lensId] = notes;
                  else delete next[lensId];
                  return { ...x, lensNotes: next };
                }),
              }));
              setToast('התשובות נשמרו');
            }}
          />
        )}
        <div className="flex flex-wrap gap-2 mt-8">
          <button className="btn btn-primary" onClick={() => setEdit(true)}>{e.type === 'none' ? 'בכל זאת נזכרתי – לרשום' : 'לערוך'}</button>
          {!confirm ? (
            <button className="btn" onClick={() => setConfirm(true)}>למחוק</button>
          ) : (
            <button
              className="btn border-dawn text-dawn"
              onClick={() => {
                update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== e.id) }));
                setToast('נמחק מהיומן');
                window.location.hash = '#/journal';
              }}
            >
              כן, למחוק לצמיתות
            </button>
          )}
        </div>
      </article>
    </Layout>
  );
}
