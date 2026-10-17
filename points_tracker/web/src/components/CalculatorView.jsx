import { useMemo, useState } from 'react';
import { Image as ImageIcon, ScanLine, X } from 'lucide-react';
import { Button, Card, ErrorBox, Input, Label, MealPicker, Spinner } from './ui';
import CameraCapture from './CameraCapture';
import MeasurePicker from './MeasurePicker';
import { plateItem, unitsFor } from '../lib/measures';
import { aiReady, describeError, readNutritionLabel } from '../lib/ai';
import { fileToDataUrl } from '../lib/image';
import { formatPoints, pointsFromNutrition, round1 } from '../lib/points';

// קלוריות לא חובה: בלי קלוריות הן מחושבות מהחלבון, הפחמימות והשומן
const FIELDS = [
  ['kcal', 'קלוריות (אנרגיה)'],
  ['protein', 'חלבון'],
  ['carbs', 'פחמימות'],
  ['fat', 'שומן'],
  ['fiber', 'סיבים'],
];

export default function CalculatorView({ settings, onLog, onSaveFood, fav, goHome }) {
  const [values, setValues] = useState({ kcal: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [labelUnits, setLabelUnits] = useState([]);
  const [servingGrams, setServingGrams] = useState(null);
  const [portion, setPortion] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [meal, setMeal] = useState('בוקר');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const nums = Object.fromEntries(FIELDS.map(([k]) => [k, parseFloat(values[k]) || 0]));
  const filled = FIELDS.some(([k]) => k !== 'kcal' && values[k] !== '');
  const per100Points = round1(pointsFromNutrition(nums));
  // מידות מהתווית (כף, כפית...) או הערכה כללית; מנה מהתווית אם הודפסה
  const units = useMemo(() => unitsFor({ units: labelUnits, grams: servingGrams }), [labelUnits, servingGrams]);

  // ממלא את השדות מהתווית שנקראה
  const fillFrom = (label) => {
    setValues(Object.fromEntries(FIELDS.map(([k]) => [k, String(label.per100[k] ?? '')])));
    setServingGrams(label.serving_grams || null);
    setLabelUnits(label.units || []);
    if (label.product_name) setFoodName(label.product_name);
  };

  const run = async (text, fn) => {
    setScanning(false);
    setBusy(text);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy('');
    }
  };

  // צילום או תמונה מהגלריה של טבלת הערכים התזונתיים
  const onImage = (dataUrl) =>
    run('קורא את התווית...', async () => {
      const label = await readNutritionLabel(settings, dataUrl);
      if (!label.readable) throw new Error('לא הצלחתי לקרוא את התווית. נסה תמונה מקרוב ובתאורה טובה.');
      fillFrom(label);
    });

  const onGallery = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onImage(await fileToDataUrl(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = (alsoLog) => {
    if (!foodName) return;
    // במאגר נשמר ל-100 גרם, עם הערכים התזונתיים והמידות, כדי שאפשר יהיה לבחור כף / כפית בפעם הבאה
    const name = `${foodName} (100 ג')`;
    const food = { name, points: per100Points, grams: 100, per100: nums, source: 'user' };
    if (labelUnits.length) food.units = labelUnits;
    onSaveFood(food);
    if (favorite) fav?.add(name);
    if (alsoLog && portion) {
      const item = plateItem(foodName, portion);
      onLog({
        foodName: `${foodName} · ${portion.label}`,
        points: portion.points,
        mealType: meal,
        components: [{ name: item.name, unitPoints: item.points, qty: item.qty }],
      });
      goHome();
    } else {
      setMessage('נשמר במאגר!');
      setFoodName('');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold">מחשבון ביסים</h2>

      <Card className="space-y-4">
        {scanning ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold">צילום טבלת ערכים תזונתיים</span>
              <button onClick={() => setScanning(false)} className="p-1 text-slate-400" aria-label="סגור">
                <X size={18} />
              </button>
            </div>
            <CameraCapture onCapture={onImage} hint="צלם את טבלת הסימון התזונתי מקרוב" />
          </div>
        ) : busy ? (
          <Spinner text={busy} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ai" onClick={() => setScanning(true)} disabled={!aiReady(settings)}>
              <ScanLine size={18} /> צלם תווית
            </Button>
            <label className={aiReady(settings) ? 'block' : 'block opacity-40 pointer-events-none'}>
              <input type="file" accept="image/*" className="hidden" onChange={onGallery} />
              <span className="h-full px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-violet-100 text-violet-700 cursor-pointer">
                <ImageIcon size={18} /> תווית מהגלריה
              </span>
            </label>
          </div>
        )}
        {!aiReady(settings) && <p className="text-xs text-slate-400">קריאת תווית דורשת חיבור לסוכן: קישור הזמנה או קוד גישה בהגדרות.</p>}
        <ErrorBox>{error}</ErrorBox>

        <p className="text-sm text-slate-500">ערכים תזונתיים ל-100 גרם</p>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === 'kcal' ? 'col-span-2' : ''}>
              <Label>{label}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={values[k]}
                placeholder="0"
                className="mt-1"
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>

      </Card>

      {filled && (
        <Card className="bg-emerald-50 border-emerald-100 space-y-4">
          <div className="text-center">
            <p className="text-sm text-emerald-700 font-bold">ביסים ל-100 גרם</p>
            <div className="text-5xl font-black text-emerald-600">{formatPoints(per100Points)}</div>
            <p className="text-xs text-slate-500 mt-1">ביס = 35 קלוריות, עם הנחה על חלבון וסיבים (משביעים יותר)</p>
          </div>
          <div className="border-t border-emerald-200 pt-4 space-y-2">
            <p className="text-sm font-bold text-slate-700">כמה שמת?</p>
            <MeasurePicker per100={nums} units={units} onChange={setPortion} />
          </div>
          <div className="border-t border-emerald-200 pt-4 space-y-3">
            <div className="space-y-1">
              <Label>שם המוצר</Label>
              <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="שם המאכל (למשל: יוגורט מולר)..." className="bg-white" />
              <p className="text-xs text-slate-500">✎ אפשר לשנות לשם שתזכור/י כשתחפש/י בפעם הבאה (למשל "פרמזן").</p>
            </div>
            <MealPicker value={meal} onChange={setMeal} />
            <Button onClick={() => save(true)} disabled={!foodName || !portion?.grams} className="w-full">
              הוסף ליומן · {portion ? formatPoints(portion.points) : 0} ביסים (וישמור במאגר)
            </Button>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
              ⭐ שמור גם במועדפים
            </label>
            <Button onClick={() => save(false)} disabled={!foodName} variant="secondary" className="w-full bg-white">
              שמור במאגר בלבד
            </Button>
            {message && <p className="text-center text-sm text-emerald-700">{message}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
