// פרומפטיקה – כלי פנימי לבעלים: לקוחות, אפיון והמלצות למערכות.
// ניווט: #/ (לקוחות) · #/client/:id (כרטיס לקוח) · #/client/:id/proposal/:pid (המלצות) · #/settings (הגדרות)
import { useEffect, useState } from 'react';
import { getToken } from './lib/api';
import { useRoute } from './lib/route';
import { Header } from './components/ui';
import Login from './screens/Login';
import Clients from './screens/Clients';
import Client from './screens/Client';
import Proposal from './screens/Proposal';
import Settings from './screens/Settings';

export default function App() {
  const route = useRoute();
  const [token, setTok] = useState(getToken);

  // השרת אמר "צריך להיכנס מחדש" – חוזרים למסך הכניסה
  useEffect(() => {
    const out = () => setTok('');
    window.addEventListener('pk-logout', out);
    return () => window.removeEventListener('pk-logout', out);
  }, []);

  if (!token) return <Login onDone={setTok} />;

  let screen = <Clients />;
  if (route[0] === 'client' && route[1] && route[2] === 'proposal' && route[3]) screen = <Proposal clientId={route[1]} pid={route[3]} />;
  else if (route[0] === 'client' && route[1]) screen = <Client id={route[1]} />;
  else if (route[0] === 'settings') screen = <Settings onLogout={() => setTok('')} />;

  return (
    <div className="min-h-dvh bg-page">
      <Header route={route} />
      <main className="mx-auto max-w-5xl px-4 py-5 lg:py-8 print:max-w-none print:p-0">{screen}</main>
    </div>
  );
}
