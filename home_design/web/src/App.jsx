import { useEffect, useState } from 'react';
import Home from './components/Home';
import Project from './components/Project';
import { listProjects } from './lib/store';

// שני מסכים: רשימת החדרים, וחדר אחד (צילום, הצעות והדמיות)
export default function App() {
  const [projects, setProjects] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  const reload = () => listProjects().then(setProjects).catch(() => { setProjects([]); setError('אי אפשר לשמור תמונות בדפדפן הזה (אולי חלון פרטי).'); });

  useEffect(() => {
    reload();
  }, []);

  const open = projects?.find((p) => p.id === openId);

  return (
    <div className="min-h-screen bg-page text-ink">
      {open ? (
        <Project key={open.id} project={open} onChange={reload} onBack={() => { setOpenId(null); reload(); }} />
      ) : (
        <Home projects={projects} error={error} onOpen={setOpenId} onCreated={(id) => reload().then(() => setOpenId(id))} />
      )}
    </div>
  );
}
