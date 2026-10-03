import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Check, ExternalLink, Globe, ImagePlus, Loader2, Plus, ScanLine, ShoppingCart, Trash2, X } from 'lucide-react';
import { pantryIdeas, scanPantry } from '../lib/api';
import { matchRecipes, mergePantry } from '../lib/fridge';
import { dataUrlToPart, photoForReading } from '../lib/image';
import { emojiOf, hostOf } from '../lib/recipes';
import { usePersistentState } from '../lib/storage';

const PLACES = [
  ['fridge', 'מקרר', '🧊'],
  ['pantry', 'מזווה', '🥫'],
];

// המלאי בבית: מסך ראשי עם המקרר והמזווה (ומה אפשר לבשל), ומסך רשימה לכל אחד מהם
export default function InventoryView({ place, ...props }) {
  return place ? <PlaceView place={place} {...props} /> : <InventoryHome {...props} />;
}

const PLACE_INFO = {
  fridge: { title: 'המקרר', icon: '🧊', bg: 'from-sky-100 to-cyan-50', ring: 'ring-sky-200', empty: 'המקרר ריק. צלמו מוצר, את כל המקרר, או כתבו מה יש.' },
  pantry: { title: 'המזווה', icon: '🥫', bg: 'from-amber-100 to-orange-50', ring: 'ring-amber-200', empty: 'המזווה ריק. צלמו מוצר, מדף שלם, או כתבו מה יש.' },
};

function InventoryHome({ session, recipes, pantry, onAdd, onAddToShopping, onPaywall, savedUrls }) {
  const [ignoreStaples, setIgnoreStaples] = usePersistentState('matkon_fridge_staples', true);
  const [source, setSource] = useState('book'); // book | web
  const names = useMemo(() => pantry.map((i) => i.name), [pantry]);
  const results = useMemo(() => matchRecipes(recipes, names, { ignoreStaples }), [recipes, names, ignoreStaples]);

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center font-bold">מה יש לי בבית?</div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <div className="mt-4 grid grid-cols-2 gap-3">
          {PLACES.map(([key]) => {
            const info = PLACE_INFO[key];
            const items = pantry.filter((i) => i.place === key);
            return (
              <a key={key} href={`#/fridge/${key}`} className={`rounded-3xl bg-gradient-to-b ${info.bg} ring-1 ${info.ring} p-4 flex flex-col items-center text-center shadow-sm active:scale-[0.98] transition`}>
                <span className="text-6xl leading-none my-2">{info.icon}</span>
                <span className="font-bold text-lg text-stone-900">{info.title}</span>
                <span className="text-sm text-stone-600">{items.length ? `${items.length} מוצרים` : 'ריק'}</span>
                {items.length > 0 && (
                  <span className="mt-1 text-xs text-stone-500 line-clamp-2">{items.slice(0, 4).map((i) => i.name).join(' · ')}</span>
                )}
              </a>
            );
          })}
        </div>

        {pantry.length > 0 ? (
          <>
            <h2 className="mt-8 mb-2 font-bold text-lg">מה אפשר לבשל?</h2>
            <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
              {[['book', 'מהספר שלי'], ['web', 'חיפוש ברשת']].map(([key, label]) => (
                <button key={key} onClick={() => setSource(key)} className={`rounded-xl py-2 text-sm font-medium ${source === key ? 'bg-white shadow-sm text-orange-700' : 'text-stone-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            {source === 'book' ? (
              <>
                <label className="mt-3 flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" checked={ignoreStaples} onChange={(e) => setIgnoreStaples(e.target.checked)} className="accent-orange-500" />
                  להניח שיש בבית מצרכי בסיס (מלח, פלפל, שמן, סוכר, קמח, בצל, שום)
                </label>
                {!results.length ? (
                  <p className="mt-8 text-center text-stone-500">אין בספר מתכון עם המוצרים האלה. נסו "חיפוש ברשת".</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {results.slice(0, 30).map(({ recipe, matched, missing, total }) => (
                      <li key={recipe.id} className="rounded-2xl bg-white shadow-sm p-3">
                        <a href={`#/r/${recipe.id}`} className="flex items-center gap-2">
                          <span className="text-xl">{emojiOf(recipe.category)}</span>
                          <span className="flex-1 font-bold truncate">{recipe.title}</span>
                          <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${missing.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {missing.length ? `${matched.length}/${total}` : 'יש הכל!'}
                          </span>
                        </a>
                        {missing.length > 0 && (
                          <>
                            <p className="mt-1.5 text-sm text-stone-500 line-clamp-2">חסר: {missing.join(' · ')}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-sm">
                              <button onClick={() => onAddToShopping(recipe, missing)} className="rounded-full bg-orange-50 text-orange-800 px-3 py-1 font-medium inline-flex items-center gap-1">
                                <ShoppingCart size={14} /> לרשימת קניות
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <WebIdeas session={session} names={names} onAdd={onAdd} onPaywall={onPaywall} savedUrls={savedUrls} />
            )}
          </>
        ) : (
          <p className="mt-8 text-center text-stone-500 leading-relaxed">
            נכנסים למקרר או למזווה, מצלמים או כותבים מה יש,
            <br />
            ונמצא מה אפשר לבשל ממה שיש בבית.
          </p>
        )}
      </div>
    </div>
  );
}

// מסך של המקרר או של המזווה: רשימה מסודרת, שורה לכל מוצר (כמו רשימת הקניות)
function PlaceView({ place, session, pantry, onChange, onToast, onPaywall }) {
  const info = PLACE_INFO[place];
  const [text, setText] = useState('');
  const [scan, setScan] = useState(null); // { busy, mode, items?, error? }
  const here = pantry.filter((i) => i.place === place);

  const addTyped = (e) => {
    e.preventDefault();
    const items = text.split(/[,\n،]+/).map((t) => t.trim()).filter(Boolean).map((name) => ({ name, place }));
    if (items.length) onChange(mergePantry(pantry, items));
    setText('');
  };

  const photos = async (files, mode) => {
    if (!files?.length) return;
    setScan({ busy: true, mode });
    try {
      const images = [];
      for (const f of [...files].slice(0, 4)) images.push(dataUrlToPart(await photoForReading(f)));
      const found = await scanPantry(session, { images, mode, place });
      if (!found.length) {
        setScan({ mode, error: 'לא זיהיתי מוצרים בתמונה. נסו תמונה קרובה ומוארת יותר.' });
        return;
      }
      if (mode === 'single') {
        // מוצר בודד נכנס מיד למסך הזה
        onChange(mergePantry(pantry, found.map((f) => ({ ...f, place }))));
        onToast(`נוסף ל${info.title}: ${found.map((f) => f.name).join(', ')}`);
        setScan(null);
      } else {
        setScan({ mode, items: found.map((f, i) => ({ ...f, key: i, on: true })) });
      }
    } catch (e) {
      if (e.status === 402) onPaywall(e.data.paymentUrl || '');
      setScan({ mode, error: e.message });
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <a href="#/fridge" className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </a>
          <div className="font-bold flex-1">{info.icon} {info.title}</div>
          <span className="text-sm text-stone-500 px-2">{here.length} מוצרים</span>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        <div className="mt-4 grid grid-cols-2 gap-2">
          <PhotoButton icon={Camera} label="צילום מוצר" sub="מזהה ומוסיף מיד" capture onFiles={(f) => photos(f, 'single')} disabled={scan?.busy} />
          <PhotoButton
            icon={ScanLine}
            label={place === 'fridge' ? 'צילום כל המקרר' : 'צילום מדף'}
            sub="ממפה את כל המוצרים"
            capture
            onFiles={(f) => photos(f, 'many')}
            disabled={scan?.busy}
          />
        </div>
        <label className={`mt-1.5 flex items-center justify-center gap-1 text-xs text-stone-500 cursor-pointer ${scan?.busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <ImagePlus size={14} /> או לבחור תמונות מהגלריה (עד 4)
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              photos(e.target.files, 'many');
              e.target.value = '';
            }}
          />
        </label>

        {scan?.busy && (
          <div className="mt-3 rounded-2xl bg-orange-50 text-orange-800 p-3 text-sm flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            {scan.mode === 'single' ? 'מזהה את המוצר…' : 'ממפה את המוצרים בתמונה… (כחצי דקה)'}
          </div>
        )}
        {scan?.error && (
          <div className="mt-3 rounded-2xl bg-red-50 text-red-700 p-3 text-sm flex items-start gap-2">
            <span className="flex-1">{scan.error}</span>
            <button onClick={() => setScan(null)} aria-label="סגירה"><X size={16} /></button>
          </div>
        )}
        {scan?.items && (
          <ScanReview
            items={scan.items}
            onCancel={() => setScan(null)}
            onConfirm={(items) => {
              onChange(mergePantry(pantry, items));
              onToast(`נוספו ${items.length} מוצרים`);
              setScan(null);
            }}
          />
        )}

        <form onSubmit={addTyped} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={place === 'fridge' ? 'הוספת מוצר (למשל: ביצים)' : 'הוספת מוצר (למשל: אורז)'}
            className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
          />
          <button className="rounded-2xl bg-orange-500 text-white px-4 font-bold flex items-center gap-1 shrink-0">
            <Plus size={18} /> הוספה
          </button>
        </form>

        {here.length > 0 ? (
          <>
            <ul className="mt-4 rounded-2xl bg-white shadow-sm divide-y divide-stone-100">
              {here.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-stone-900">{h.name}</span>
                    {h.qty && <span className="block text-xs text-stone-500">{h.qty}</span>}
                  </span>
                  <button onClick={() => onChange(pantry.filter((x) => x.id !== h.id))} className="p-1 text-stone-300 hover:text-red-500" aria-label={`הסרת ${h.name}`}>
                    <X size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => window.confirm(`לרוקן את ה${place === 'fridge' ? 'מקרר' : 'מזווה'}?`) && onChange(pantry.filter((x) => x.place !== place))}
              className="mt-3 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-red-600 inline-flex items-center gap-1.5"
            >
              <Trash2 size={15} /> ניקוי הכל
            </button>
          </>
        ) : (
          <p className="mt-10 text-center text-stone-500 leading-relaxed">
            <span className="text-6xl block mb-3">{info.icon}</span>
            {info.empty}
          </p>
        )}
      </div>
    </div>
  );
}

function PhotoButton({ icon: Icon, label, sub, capture, multiple, onFiles, disabled }) {
  return (
    <label className={`rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-800 p-3 flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Icon size={24} className="shrink-0" />
      <span className="min-w-0">
        <span className="block font-bold text-sm">{label}</span>
        <span className="block text-xs text-orange-700/80">{sub}</span>
      </span>
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' } : {})}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

// אחרי צילום של כל המקרר: בודקים, מתקנים ומאשרים לפני שמוסיפים
function ScanReview({ items: initial, onCancel, onConfirm }) {
  const [items, setItems] = useState(initial);
  const set = (key, patch) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const chosen = items.filter((i) => i.on && i.name.trim());
  return (
    <div className="mt-3 rounded-2xl bg-white shadow-sm p-3">
      <div className="font-bold mb-1">מצאתי {items.length} מוצרים</div>
      <p className="text-xs text-stone-500 mb-2">מסמנים מה להוסיף, אפשר לתקן שם ולבחור מקרר או מזווה.</p>
      <ul className="space-y-1.5 max-h-80 overflow-y-auto">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2">
            <button
              onClick={() => set(i.key, { on: !i.on })}
              className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center ${i.on ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}
              aria-label={i.on ? 'לא להוסיף' : 'להוסיף'}
            >
              {i.on && <Check size={14} strokeWidth={3} />}
            </button>
            <input value={i.name} onChange={(e) => set(i.key, { name: e.target.value })} className="flex-1 min-w-0 rounded-lg border border-stone-200 px-2 py-1 text-sm" />
            {i.qty && <span className="text-xs text-stone-500 shrink-0 max-w-20 truncate">{i.qty}</span>}
            <button
              onClick={() => set(i.key, { place: i.place === 'fridge' ? 'pantry' : 'fridge' })}
              className="text-lg shrink-0"
              title={i.place === 'fridge' ? 'מקרר' : 'מזווה'}
            >
              {i.place === 'fridge' ? '🧊' : '🥫'}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          disabled={!chosen.length}
          onClick={() => onConfirm(chosen.map(({ name, qty, place }) => ({ name: name.trim(), qty, place })))}
          className="flex-1 rounded-xl bg-orange-500 text-white font-bold py-2.5 disabled:opacity-40"
        >
          הוספה של {chosen.length} מוצרים
        </button>
        <button onClick={onCancel} className="rounded-xl bg-stone-100 px-4 font-medium">ביטול</button>
      </div>
    </div>
  );
}

function WebIdeas({ session, names, onAdd, onPaywall, savedUrls }) {
  const [wish, setWish] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState({});

  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResults(await pantryIdeas(session, names, wish.trim()));
    } catch (err) {
      if (err.status === 402) onPaywall(err.data.paymentUrl || '');
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <form onSubmit={run} className="flex gap-2">
        <input
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          placeholder="בא לי… (לא חובה) למשל: משהו מהיר לערב"
          className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
        />
        <button disabled={busy} className="rounded-2xl bg-orange-500 text-white px-4 font-bold flex items-center gap-1 shrink-0 disabled:opacity-40">
          <Globe size={18} /> חיפוש
        </button>
      </form>
      {busy && (
        <div className="mt-8 text-center text-stone-500">
          <Loader2 className="animate-spin mx-auto mb-2 text-orange-500" size={28} />
          מחפש מתכונים לפי מה שיש לך… (חצי דקה בערך)
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {!busy && !results && !error && (
        <p className="mt-6 text-center text-sm text-stone-500">נחפש ברשת מתכונים שמשתמשים בעיקר במה שיש לך בבית.</p>
      )}
      {results && !results.length && <p className="mt-6 text-center text-stone-500">לא נמצאו מתכונים. נסו שוב.</p>}
      <ul className="mt-3 space-y-2">
        {(results || []).map((r) => {
          let key = '';
          try {
            key = hostOf(r.url) + new URL(r.url).pathname.replace(/\/+$/, '');
          } catch { /* קישור לא תקין */ }
          const saved = added[r.url] || savedUrls.has(key);
          return (
            <li key={r.url} className="rounded-2xl bg-white shadow-sm p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.title}</div>
                <div className="text-xs text-stone-500 mt-0.5" dir="auto">{r.site || hostOf(r.url)}</div>
                {r.description && <p className="text-sm text-stone-600 mt-1">{r.description}</p>}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-orange-700">
                  <ExternalLink size={12} /> לצפייה במתכון
                </a>
              </div>
              <button
                disabled={saved}
                onClick={() => {
                  onAdd(r.url, r.title);
                  setAdded((a) => ({ ...a, [r.url]: true }));
                }}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1 ${saved ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-500 text-white'}`}
              >
                {saved ? <><Check size={16} /> נוסף</> : <><Plus size={16} /> לספר</>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
