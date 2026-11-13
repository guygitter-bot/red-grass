import { useEffect, useState } from 'react';
import Home from './components/Home';
import Wizard from './components/Wizard';
import Book from './components/Book';
import { LocalReader, SharedReader } from './components/Reader';

// הכתובת (אחרי #) קובעת את המסך, כך שכפתור "אחורה" של הטלפון עובד:
//   #/            הספרים שלי
//   #/new         ספר חדש (שאלון)
//   #/book/<id>   ספר שלי: מתווה, כתיבה, שיתוף      #/book/<id>/read  קריאה
//   #/read/<id>   ספר שקיבלתי בקישור
const parse = () => (window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean));

export default function App() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onHash = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('hashchange', onHash); };
  }, []);

  const [screen, id, sub] = route;
  let view = <Home />;
  if (screen === 'new') view = <Wizard />;
  else if (screen === 'book' && id) view = sub === 'read' ? <LocalReader key={id} id={id} /> : <Book key={id} id={id} />;
  else if (screen === 'read' && id) view = <SharedReader key={id} id={id} />;

  return <div className="min-h-screen bg-page text-ink">{view}</div>;
}
