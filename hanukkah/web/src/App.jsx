import { useEffect, useState } from 'react';
import { AppProvider } from './context';
import Home from './screens/Home';
import Story from './screens/Story';
import Customs from './screens/Customs';
import Quiz from './screens/Quiz';
import Games from './screens/Games';
import Dreidel from './screens/Dreidel';
import Memory from './screens/Memory';
import Candles from './screens/Candles';
import Catch from './screens/Catch';
import Scramble from './screens/Scramble';
import Extras from './screens/Extras';
import Facts from './screens/Facts';
import Riddles from './screens/Riddles';
import Songs from './screens/Songs';
import Recipe from './screens/Recipe';
import CardMaker from './screens/CardMaker';
import Badges from './screens/Badges';

// ניווט לפי ה-hash: #/story, #/games/dreidel ...
const ROUTES = {
  '/': Home,
  '/story': Story,
  '/customs': Customs,
  '/quiz': Quiz,
  '/games': Games,
  '/games/dreidel': Dreidel,
  '/games/memory': Memory,
  '/games/candles': Candles,
  '/games/catch': Catch,
  '/games/scramble': Scramble,
  '/extras': Extras,
  '/extras/facts': Facts,
  '/extras/riddles': Riddles,
  '/extras/songs': Songs,
  '/extras/recipe': Recipe,
  '/extras/card': CardMaker,
  '/badges': Badges,
};

function currentPath() {
  const p = window.location.hash.replace(/^#/, '') || '/';
  return ROUTES[p] ? p : '/';
}

export default function App() {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onHash = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const Screen = ROUTES[path];
  return (
    <AppProvider>
      <Screen key={path} />
    </AppProvider>
  );
}
