// הצוות – מסך ראשי: כניסה, ניווט לפי #, ונתוני הצוות המשותפים לכל המסכים
import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setUnauthHandler } from './lib/api';
import { parseRoute } from './lib/route';
import { teamInterval } from './lib/polling';
import { usePoll } from './lib/usePoll';
import Login from './components/Login';
import Shell from './components/Shell';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUnauthHandler(() => {
      setAuthed(false);
      setTeam(null);
    });
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const refresh = useCallback(() => {
    if (!getToken()) return Promise.resolve();
    return api('/app/team')
      .then((t) => {
        setTeam(t);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  if (!authed) {
    return (
      <Login
        onDone={() => {
          setAuthed(true);
          if (!location.hash) location.hash = '#/';
        }}
      />
    );
  }
  return <Authed route={route} team={team} error={error} refresh={refresh} onLogout={() => setAuthed(false)} />;
}

// החלק שרץ רק אחרי כניסה (כדי שהרענון לא יתחיל לפני כן)
function Authed({ route, team, error, refresh, onLogout }) {
  usePoll(refresh, teamInterval(team));
  return <Shell route={route} team={team} error={error} refresh={refresh} onLogout={onLogout} />;
}
