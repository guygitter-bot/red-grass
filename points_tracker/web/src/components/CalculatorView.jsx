import { useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { Button, Card, ErrorBox, Input, Label, MealPicker, Spinner } from './ui';
import CameraCapture from './CameraCapture';
import { describeError, readNutritionLabel } from '../lib/ai';
import { formatPoints, pointsForGrams, pointsFromNutrition, round1 } from '../lib/points';

const FIELDS = [
  ['protein', 'חלבון'],
  ['carbs', 'פחמימות'],
  ['fat', 'שומן'],
  ['fiber', 'סיבים'],
];

export default function CalculatorView({ settings, onLog, onSaveFood, goHome }) {
  const [values, setValues] = useState({ protein: '', carbs: '', fat: '', fiber: '' });
  const [weight, setWeight] = useState('');
  const [foodName, setFoodName] = useState('');
  const [meal, setMeal] = useState('בוקר');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const nums = Object.fromEntries(FIELDS.map(([k]) => [k, parseFloat(values[k]) || 0]));
  const filled = FIELDS.some(([k]) => values[k] !== '');
  const w = parseFloat(weight);
  const result = round1(w > 0 ? pointsForGrams(nums, w) : pointsFromNutrition(nums));

  const onImage = async (dataUrl) => {
    setScanning(false);
    setBusy(true);
    setError('');
    try {
      const label = await readNutritionLabel(settings, dataUrl);
      if (!label.readable) throw new Error('לא הצלחתי לקרוא את התווית. נסה לצלם מקרוב ובתאורה טובה.');
      setValues(Object.fromEntries(FIELDS.map(([k]) => [k, String(label.per100[k] ?? '')])));
      if (label.serving_grams) setWeight(String(label.serving_grams));
      if (label.product_name) setFoodName(label.product_name);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const save = (alsoLog) => {
    if (!foodName) return;
    const name = w > 0 ? `${foodName} (${w} ג')` : `${foodName} (100 ג')`;
    onSaveFood({ name, points: result, grams: w > 0 ? w : 100, per100: nums, source: 'user' });
    if (alsoLog) {
      onLog({ foodName: name, points: result, mealType: meal, components: [{ name, unitPoints: result, qty: 1 }] });
      goHome();
    } else {
      setMessage('נשמר במאגר!');
      setFoodName('');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold">מחשבון נקודות</h2>

      <Card className="space-y-4">
        {scanning ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold">צילום טבלת ערכים תזונתיים</span>
              <button onClick={() => setScanning(false)} className="p-1 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <CameraCapture onCapture={onImage} hint="צלם את טבלת הסימון התזונתי מקרוב" />
          </div>
        ) : busy ? (
          <Spinner text="קורא את התווית..." />
        ) : (
          <Button variant="ai" className="w-full" onClick={() => setScanning(true)} disabled={!settings.apiKey}>
            <ScanLine size={18} /> סרוק תווית מהאריזה
          </Button>
        )}
        {!settings.apiKey && <p className="text-xs text-slate-400">סריקת תווית דורשת מפתח API בהגדרות.</p>}
        <ErrorBox>{error}</ErrorBox>

        <p className="text-sm text-slate-500">ערכים תזונתיים ל-100 גרם</p>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(([k, label]) => (
            <div key={k}>
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

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <Label>משקל המנה בגרמים (אופציונלי)</Label>
          <p className="text-xs text-slate-500 my-2">בלי משקל - התוצאה היא ל-100 גרם.</p>
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="למשל: 150" className="bg-white" />
            <span className="text-slate-500 font-medium">גרם</span>
          </div>
        </div>
      </Card>

      {filled && (
        <Card className="bg-emerald-50 border-emerald-100 space-y-4">
          <div className="text-center">
            <p className="text-sm text-emerald-700 font-bold">{w > 0 ? `נקודות ל-${w} גרם` : 'נקודות ל-100 גרם'}</p>
            <div className="text-5xl font-black text-emerald-600">{formatPoints(result)}</div>
          </div>
          <div className="border-t border-emerald-200 pt-4 space-y-3">
            <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="שם המאכל (למשל: יוגורט מולר)..." className="bg-white" />
            <MealPicker value={meal} onChange={setMeal} />
            <Button onClick={() => save(true)} disabled={!foodName} className="w-full">
              הוסף ליומן (וישמור במאגר)
            </Button>
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
