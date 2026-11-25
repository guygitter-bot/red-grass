import { useEffect, useState } from 'react';
import { AppProvider } from './context';
import Home from './screens/Home';
import Intend from './screens/Intend';
import Ritual from './screens/Ritual';
import Nap from './screens/Nap';
import Morning from './screens/Morning';
import Journal from './screens/Journal';
import Entry from './screens/Entry';
import Insights from './screens/Insights';
import Learn from './screens/Learn';
import Settings from './screens/Settings';

// ניווט לפי ה-hash: #/intend, #/entry/<id> ...
const ROUTES = {
  '/': Home,
  '/intend': Intend,
  '/ritual': Ritual,
  '/nap': Nap,
  '/morning': Morning,
  '/journal': Journal,
  '/entry': Entry,
  '/insights': Insights,
  '/learn': Learn,
  '/settings': Settings,
};

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, ...rest] = raw.split('/').filter(Boolean);
  const path = p ? `/${p}` : '/';
  return ROUTES[path] ? { path, param: decodeURIComponent(rest.join('/')) } : { path: '/', param: '' };
}

export default function App() {
  const [route, setRoute] = useState(parse());

  useEffect(() => {
    const onHash = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const Screen = ROUTES[route.path];
  return (
    <AppProvider>
      <Screen key={route.path + route.param} param={route.param} />
    </AppProvider>
  );
}
