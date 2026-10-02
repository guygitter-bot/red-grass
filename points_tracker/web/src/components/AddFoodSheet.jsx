import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Globe, MessageSquareText, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { Button, ErrorBox, Input, MealPicker, Sheet, Spinner, Tabs } from './ui';
import PortionPicker from './PortionPicker';
import MeasurePicker from './MeasurePicker';
import { baseName, plateItem, unitsFor } from '../lib/measures';
import CameraCapture from './CameraCapture';
import AnalysisResult from './AnalysisResult';
import { aiReady, analyzeFood, describeError, researchFood, researchToFood } from '../lib/ai';
import { findByName, normalize, searchFoods } from '../lib/foodDb';
import { formatPoints, qtyPrefix, round1 } from '../lib/points';
import { newId } from '../lib/storage';

const AUTO_DELAY_MS = 1500;
// חיפושים שהסוכן כבר ביצע בהפעלה הזו, כדי לא לשלם פעמיים על אותו חיפוש.
const researched = new Set();

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'בוקר';
  if (h < 16) return 'צהריים';
  if (h < 21) return 'ערב';
  return 'ביניים';
}

// מאכל עם ערכים תזונתיים: בוחרים מידה (כף, כפית, גרם...). אחרת: כמות מתוך היחידה שבשם.
function MeasuredFood({ item, onAdd, onDone }) {
  const units = useMemo(() => unitsFor(item), [item]);
  const [portion, setPortion] = useState(null);
  const add = () => {
    onAdd(plateItem(baseName(item.name), portion));
    onDone();
  };
  return (
    <div className="px-3 pb-3 space-y-3">
      <MeasurePicker per100={item.per100} units={units} onChange={setPortion} />
      <Button className="w-full py-2" disabled={!portion?.grams} onClick={add}>
        <Plus size={18} /> הוסף לצלחת · {portion ? formatPoints(portion.points) : 0} נק'
      </Button>
    </div>
  );
}

function FoodRow({ item, onAdd }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  return (
    <div className="border border-slate-100 rounded-xl hover:border-emerald-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-right">
        <span className="flex-1 text-slate-700 font-medium">
          {item.name}
          {item.source === 'agent' && <Sparkles size={12} className="inline mr-1 text-violet-400" />}
        </span>
        <span className="font-bold text-emerald-600 mr-2">{formatPoints(item.points)}</span>
      </button>
      {open && item.per100 && <MeasuredFood item={item} onAdd={onAdd} onDone={() => setOpen(false)} />}
      {open && !item.per100 && (
        <div className="px-3 pb-3 space-y-3">
          <PortionPicker value={qty} onChange={setQty} unitLabel="יחידה" />
          <Button
            className="w-full py-2"
            onClick={() => {
              onAdd({ name: item.name, points: Number(item.points), qty });
              setOpen(false);
              setQty(1);
            }}
          >
            <Plus size={18} /> הוסף לצלחת · {formatPoints(item.points * qty)} נק'
          </Button>
        </div>
      )}
    </div>
  );
}

function Sources({ urls }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.slice(0, 4).map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="text-xs text-violet-600 underline">
          {u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
        </a>
      ))}
    </div>
  );
}

export default function AddFoodSheet({ db, recent, settings, dateLabel, onLog, onSaveFood, onClose }) {
  const [tab, setTab] = useState('search');
  const [meal, setMeal] = useState(defaultMeal);
  const [plate, setPlate] = useState([]);

  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPoints, setCustomPoints] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const [image, setImage] = useState(null);
  const [details, setDetails] = useState('');
  const [text, setText] = useState('');

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [researching, setResearching] = useState('');
  const [researchError, setResearchError] = useState('');
  const [agentFood, setAgentFood] = useState(null); // { query, food | null, notes }

  const results = useMemo(() => searchFoods(db, search), [db, search]);
  const total = round1(plate.reduce((s, p) => s + p.points * p.qty, 0));
  const hasKey = aiReady(settings);

  const addToPlate = (item) => setPlate((p) => [...p, { ...item, id: newId() }]);

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy('');
    }
  };

  // הסוכן מחפש ברשת ומוסיף את המאכל למאגר בעצמו, בלי קשר למה שנרשם ביומן.
  const runResearch = async (query) => {
    const key = normalize(query);
    researched.add(key);
    setResearching(query);
    setResearchError('');
    try {
      const result = await researchFood(settings, query);
      const food = researchToFood(result);
      if (food) onSaveFood(food);
      setAgentFood({ query, food, notes: result.notes_he });
    } catch (err) {
      researched.delete(key);
      setResearchError(describeError(err));
    } finally {
      setResearching('');
    }
  };

  const autoAgent = hasKey && settings.autoAgent !== false;
  // מה שבאמת נשמר במאגר: אם כבר היה מאכל ידני באותו שם, הוא נשאר והסוכן לא דורס אותו.
  const storedAgentFood = agentFood?.food && (findByName(db, agentFood.food.name) || agentFood.food);
  const keptManual = storedAgentFood && storedAgentFood.source !== 'agent';
  useEffect(() => {
    const query = search.trim();
    if (!autoAgent || researching || results.length > 0 || query.length < 3 || researched.has(normalize(query))) return;
    const timer = setTimeout(() => runResearch(query), AUTO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, results.length, autoAgent, researching]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = (input) =>
    run('מנתח את המאכל...', async () => {
      setAnalysis(null);
      setAnalysis(await analyzeFood(settings, db, input));
    });

  const onAnalysisAdd = (item, saveToDb) => {
    addToPlate(item);
    if (saveToDb) onSaveFood({ name: item.name, points: item.points, source: 'ai' });
    setAnalysis(null);
    setImage(null);
    setDetails('');
    setText('');
    setTab('search');
  };

  const logPlate = () => {
    const foodName = plate.map((p) => `${qtyPrefix(p.qty)}${p.name}`).join(' + ');
    onLog({
      foodName,
      points: total,
      mealType: meal,
      components: plate.map(({ name, points, qty, parts }) => ({ name, unitPoints: points, qty, parts })),
    });
  };

  return (
    <Sheet title="הוספת ארוחה" subtitle={`מוסיף ל: ${dateLabel}`} onClose={onClose}>
      <MealPicker value={meal} onChange={setMeal} />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError('');
        }}
        tabs={[
          { id: 'search', label: 'חיפוש', icon: Search },
          { id: 'photo', label: 'צילום', icon: Camera },
          { id: 'text', label: 'תיאור / מתכון', icon: MessageSquareText },
        ]}
      />

      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-3.5 text-slate-400" size={18} />
            <Input
              placeholder="חפש מאכל..."
              className="pr-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCustomName(e.target.value);
                setSavedMsg('');
              }}
            />
          </div>

          {!search && recent.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">אכלת לאחרונה</p>
              {recent.map((item) => (
                <FoodRow key={item.name} item={item} onAdd={addToPlate} />
              ))}
            </div>
          )}

          {results.map((item) => (
            <FoodRow key={item.name} item={item} onAdd={addToPlate} />
          ))}

          {search && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs text-slate-400">{results.length ? 'לא מה שחיפשת?' : 'לא נמצא במאגר.'}</p>
              {researching ? (
                <Spinner text={`הסוכן מחפש את "${researching}" ברשת ומוסיף למאגר...`} />
              ) : storedAgentFood ? (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 space-y-2">
                  <p className="text-xs text-violet-700 font-medium flex items-center gap-1">
                    <Sparkles size={12} /> {keptManual ? 'כבר במאגר (הוספת ידנית, נשמר הערך שלך):' : 'הסוכן הוסיף למאגר:'}
                  </p>
                  <FoodRow item={storedAgentFood} onAdd={addToPlate} />
                  {agentFood.food.published_points != null &&
                    Math.abs(agentFood.food.published_points - agentFood.food.points) >= 0.5 && (
                      <p className="text-xs text-slate-500">ערך שפורסם ברשת: {agentFood.food.published_points} נק'</p>
                    )}
                  <Sources urls={agentFood.food.sources} />
                </div>
              ) : agentFood && normalize(agentFood.query) === normalize(search) ? (
                <ErrorBox>הסוכן לא מצא מידע אמין על "{agentFood.query}". {agentFood.notes}</ErrorBox>
              ) : hasKey && !autoAgent ? (
                <Button variant="ai" className="w-full" onClick={() => runResearch(search.trim())}>
                  <Globe size={18} /> הסוכן יחפש "{search}" ברשת ויוסיף למאגר
                </Button>
              ) : hasKey && results.length > 0 ? (
                <Button variant="ai" className="w-full" onClick={() => runResearch(search.trim())}>
                  <Globe size={18} /> לא זה? הסוכן יחפש "{search}" ברשת
                </Button>
              ) : !hasKey ? (
                <p className="text-xs text-slate-500">כדי שהסוכן יחפש ויוסיף מאכלים, פתח את קישור ההזמנה או הזן קוד גישה בהגדרות.</p>
              ) : null}
              <ErrorBox>{researchError}</ErrorBox>
              <ErrorBox>{error}</ErrorBox>

              <p className="text-xs text-slate-400">הוספה ידנית של מאכל וניקוד:</p>
              <div className="flex gap-2">
                <Input placeholder="שם המאכל" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder="נק'"
                  className="w-20 text-center"
                  value={customPoints}
                  onChange={(e) => setCustomPoints(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="py-2"
                  disabled={!customName || customPoints === ''}
                  onClick={() => {
                    const item = { name: customName, points: parseFloat(customPoints) };
                    addToPlate({ ...item, qty: 1 });
                    onSaveFood({ ...item, source: 'user' });
                    setSearch('');
                    setCustomPoints('');
                  }}
                >
                  <Plus size={18} /> לצלחת ולמאגר
                </Button>
                <Button
                  variant="secondary"
                  className="py-2"
                  disabled={!customName || customPoints === ''}
                  onClick={() => {
                    onSaveFood({ name: customName, points: parseFloat(customPoints), source: 'user' });
                    setSavedMsg(`"${customName}" נשמר במאגר`);
                    setCustomPoints('');
                  }}
                >
                  למאגר בלבד
                </Button>
              </div>
              {savedMsg && <p className="text-xs text-center text-emerald-600">{savedMsg}</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'photo' &&
        (!hasKey ? (
          <ErrorBox>כדי לנקד מצילום צריך קוד גישה (מקישור ההזמנה) או מפתח API בהגדרות.</ErrorBox>
        ) : busy ? (
          <Spinner text={busy} />
        ) : analysis ? (
          <AnalysisResult analysis={analysis} db={db} onAdd={onAnalysisAdd} />
        ) : image ? (
          <div className="space-y-3">
            <img src={image} alt="" className="w-full rounded-2xl max-h-72 object-cover" />
            <Input
              placeholder="פרטים נוספים (לא חובה): למשל 'רוטב בצד', 'אכלתי חצי'"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <ErrorBox>{error}</ErrorBox>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setImage(null)}>
                צלם שוב
              </Button>
              <Button variant="ai" onClick={() => runAnalysis({ imageDataUrl: image, text: details })}>
                <Sparkles size={18} /> נקד
              </Button>
            </div>
          </div>
        ) : (
          <CameraCapture onCapture={setImage} hint="צלם את המנה מלמעלה, כך שכל הצלחת נראית" />
        ))}

      {tab === 'text' &&
        (!hasKey ? (
          <ErrorBox>כדי לנקד מתיאור או ממרכיבים צריך קוד גישה (מקישור ההזמנה) או מפתח API בהגדרות.</ErrorBox>
        ) : busy ? (
          <Spinner text={busy} />
        ) : analysis ? (
          <AnalysisResult analysis={analysis} db={db} onAdd={onAnalysisAdd} />
        ) : (
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={
                'מה אכלת? למשל:\nחצי פיתה עם שוקולד\n2 משולשי פיצה\n\nאו רשימת מרכיבים של מתכון:\n2 כוסות קמח, 3 ביצים, 100 גרם חמאה... יוצא 12 עוגיות'
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <ErrorBox>{error}</ErrorBox>
            <Button variant="ai" className="w-full" disabled={!text.trim()} onClick={() => runAnalysis({ text })}>
              <Sparkles size={18} /> חשב ניקוד
            </Button>
          </div>
        ))}

      {plate.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-3 -mx-5 px-5 pb-1 space-y-2">
          {plate.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">
                {qtyPrefix(p.qty)}
                {p.name}
              </span>
              <span className="font-bold mx-2">{formatPoints(p.points * p.qty)}</span>
              <button onClick={() => setPlate(plate.filter((x) => x.id !== p.id))} className="text-red-300 hover:text-red-500 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button onClick={logPlate} className="w-full">
            רשום ליומן ({meal}) · {formatPoints(total)} נק'
          </Button>
        </div>
      )}
    </Sheet>
  );
}
