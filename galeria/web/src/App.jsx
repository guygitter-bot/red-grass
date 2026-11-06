import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Start from './screens/Start.jsx';
import Scan from './screens/Scan.jsx';
import Home from './screens/Home.jsx';
import Review from './screens/Review.jsx';
import * as source from './lib/source.js';
import { analyzeAll, KINDS } from './lib/cleanup.js';
import { SOURCES, TOPICS } from './lib/categories.js';
import { featKey, loadFeats, loadKept, saveFeats, saveKept } from './lib/store.js';
import { bytes, count } from './lib/format.js';

const STARTED = 'gl_started';

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return hash.replace(/^#\/?/, '').split('/');
}

export default function App() {
  const [phase, setPhase] = useState('start'); // start | denied | list | scan | ready
  const [photos, setPhotos] = useState([]);
  const [feats, setFeats] = useState({});
  const [kept, setKept] = useState(() => loadKept());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [toast, setToast] = useState('');
  const [demo, setDemo] = useState(false);
  const scanning = useRef(false);
  const route = useRoute();

  const scan = useCallback(async () => {
    if (scanning.current) return;
    scanning.current = true;
    try {
      const acc = await source.access();
      if (!acc.granted) {
        setPhase('denied');
        return;
      }
      setDemo(!!acc.demo);
      try {
        localStorage.setItem(STARTED, '1');
      } catch {
        // מצב פרטי
      }
      setPhase('list');
      const list = await source.list();
      list.sort((a, b) => (b.date || 0) - (a.date || 0));
      const cache = loadFeats();
      const f = {};
      const missing = [];
      for (const p of list) {
        const c = cache[featKey(p)];
        if (c) f[p.id] = c;
        else missing.push(p.id);
      }
      setPhotos(list);
      setFeats({ ...f });
      if (missing.length) {
        setProgress({ done: 0, total: missing.length });
        setPhase('scan');
        let n = 0;
        await source.analyze(missing, (items, done) => {
          for (const it of items) {
            const { id, ...rest } = it;
            f[id] = rest;
          }
          setProgress({ done, total: missing.length });
          if (++n % 15 === 0) saveFeats(list, f);
        });
        setFeats({ ...f });
        saveFeats(list, f);
      }
      setPhase('ready');
    } catch {
      setToast('משהו השתבש בקריאת הגלריה. אפשר לנסות שוב.');
      setPhase('start');
    } finally {
      scanning.current = false;
    }
  }, []);

  // בפעם הבאה שנכנסים – סורקים מיד (ההרשאה כבר ניתנה)
  useEffect(() => {
    let started = false;
    try {
      started = localStorage.getItem(STARTED) === '1';
    } catch {
      started = false;
    }
    if (started) scan();
  }, [scan]);

  useEffect(() => {
    if (!toast) return () => {};
    const t = setTimeout(() => setToast(''), 6000);
    return () => {
      clearTimeout(t);
    };
  }, [toast]);

  const byId = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p])), [photos]);
  const result = useMemo(() => analyzeAll(photos, feats, { kept }), [photos, feats, kept]);
  const sizeOf = useCallback((id) => byId[id]?.size || 0, [byId]);

  const keep = useCallback((ids) => {
    if (!ids.length) return;
    setKept((k) => {
      const n = new Set(k);
      ids.forEach((id) => n.add(id));
      saveKept(n);
      return n;
    });
  }, []);

  const trash = useCallback(
    async (ids, keepIds = []) => {
      if (!ids.length) return false;
      let ok = false;
      try {
        ok = await source.trash(ids);
      } catch (e) {
        setToast(e?.code === 'OLD_ANDROID' ? 'מחיקה מתוך האפליקציה עובדת מאנדרואיד 11 ומעלה.' : 'המחיקה לא הצליחה. אפשר לנסות שוב.');
        return false;
      }
      if (!ok) {
        setToast('המחיקה בוטלה – שום דבר לא נמחק.');
        return false;
      }
      const gone = new Set(ids);
      const freed = ids.reduce((s, id) => s + (byId[id]?.size || 0), 0);
      setPhotos((ps) => ps.filter((p) => !gone.has(p.id)));
      keep(keepIds);
      setToast(`🗑 ${count(ids.length)} תמונות הועברו לפח (${bytes(freed)}). אפשר לשחזר מהפח של הגלריה במשך 30 יום.`);
      return true;
    },
    [byId, keep],
  );

  let screen;
  if (phase === 'start' || phase === 'denied') screen = <Start denied={phase === 'denied'} onStart={scan} />;
  else if (phase === 'list' || phase === 'scan') screen = <Scan stage={phase} done={progress.done} total={progress.total} />;
  else {
    const [section, key] = route;
    const common = { byId, onTrash: trash, onKeep: keep };
    const kind = KINDS.find((k) => k.key === key);
    if (section === 'clean' && kind) {
      const isGroup = key === 'dup' || key === 'similar';
      screen = (
        <Review
          key={route.join('/')}
          title={`${kind.icon} ${kind.label}`}
          desc={
            isGroup
              ? 'בכל קבוצה הטובה מכולן מסומנת ⭐ ונשארת; השאר מסומנות למחיקה. הקשה על תמונה מחליפה את הסימון.'
              : `${kind.desc}. הכול מסומן למחיקה – הקשה על תמונה משאירה אותה.`
          }
          groups={isGroup ? result[key] : null}
          ids={isGroup ? null : result.lists[key]}
          preselect
          {...common}
        />
      );
    } else if (section === 'topic' || section === 'source') {
      const meta = (section === 'topic' ? TOPICS : SOURCES).find((t) => t.key === key);
      const ids = (section === 'topic' ? result.byTopic : result.bySource)[key] || [];
      screen = meta ? (
        <Review
          key={route.join('/')}
          title={`${meta.icon} ${meta.label}`}
          desc={`${count(ids.length)} תמונות. להקיש על תמונות כדי לסמן אותן למחיקה.`}
          ids={ids}
          {...common}
        />
      ) : null;
    }
    if (!screen) screen = <Home photos={photos} result={result} sizeOf={sizeOf} onRescan={scan} demo={demo} />;
  }

  return (
    <>
      {screen}
      {toast && (
        <div role="status" className="fixed z-[60] bottom-24 inset-x-4 mx-auto max-w-md bg-ink text-page rounded-2xl p-3 text-sm text-center shadow-lg" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </>
  );
}
