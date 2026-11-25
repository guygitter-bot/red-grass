import { useState } from 'react';
import Layout from '../components/Layout';
import { EntryCard } from './Home';
import { useApp } from '../context';
import { searchEntries } from '../lib/stats';

// היומן: כל החלומות, עם חיפוש (גם לפי תגית מהקישור #/journal/<תגית>)
export default function Journal({ param }) {
  const { data } = useApp();
  const [q, setQ] = useState(param || '');
  const list = searchEntries(data.entries, q);

  return (
    <Layout title="יומן החלומות" tab="#/journal">
      <div className="flex gap-2 items-center mb-5">
        <input className="field" type="search" value={q} placeholder="חיפוש: מילה, אדם, סמל" aria-label="חיפוש ביומן" onChange={(e) => setQ(e.target.value)} />
        <a href="#/morning" className="btn btn-primary shrink-0">חלום חדש</a>
      </div>
      {data.entries.length === 0 ? (
        <div className="text-center py-10">
          <p className="serif text-2xl font-bold m-0">היומן עוד ריק</p>
          <p className="text-muted">מחר בבוקר, ממש עם ההתעוררות, לפתוח את האפליקציה ולרשום – גם משפט אחד.</p>
          <a href="#/intend" className="btn btn-primary">לבחור כוונה ללילה</a>
        </div>
      ) : list.length === 0 ? (
        <p className="text-muted">לא נמצא חלום עם "{q}".</p>
      ) : (
        <ul className="list-none p-0 m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <li key={e.id}>
              <EntryCard e={e} />
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
