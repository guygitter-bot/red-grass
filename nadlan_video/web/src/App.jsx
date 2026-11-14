import { useEffect, useState } from 'react';
import Login from './components/Login';
import Home from './components/Home';
import NewFilm from './components/NewFilm';
import Project from './components/Project';
import { hasPassword, setOnLogout } from './lib/api';
import { listProjects } from './lib/store';

// ארבעה מסכים: כניסה, רשימת הסרטונים, סרטון חדש, וסרטון אחד (שוטים + הסרט המלא)
export default function App() {
  const [signedIn, setSignedIn] = useState(hasPassword());
  const [projects, setProjects] = useState(null);
  const [screen, setScreen] = useState({ name: 'home' });
  const [error, setError] = useState('');

  const reload = () => listProjects().then(setProjects).catch(() => { setProjects([]); setError('אי אפשר לשמור סרטונים בדפדפן הזה (אולי חלון פרטי).'); });

  useEffect(() => {
    setOnLogout(() => setSignedIn(false));
    reload();
  }, []);

  const open = screen.name === 'project' ? projects?.find((p) => p.id === screen.id) : null;

  return (
    <div className="min-h-screen bg-page text-ink">
      {!signedIn ? (
        <Login onDone={() => setSignedIn(true)} />
      ) : open ? (
        <Project key={open.id} initial={open} onBack={() => { setScreen({ name: 'home' }); reload(); }} />
      ) : screen.name === 'new' ? (
        <NewFilm onBack={() => setScreen({ name: 'home' })} onCreated={(id) => reload().then(() => setScreen({ name: 'project', id }))} />
      ) : (
        <Home projects={projects} error={error} onOpen={(id) => setScreen({ name: 'project', id })} onNew={() => setScreen({ name: 'new' })} onChange={reload} />
      )}
    </div>
  );
}
