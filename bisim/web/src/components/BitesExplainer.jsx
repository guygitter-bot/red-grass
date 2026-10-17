import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Card, Input, Label } from './ui';
import { KCAL_PER_BITE, bitesForGrams, formatBites, kcalOf } from '../lib/bites';

// דוגמאות מהמאגר המובנה (ערכים ל-100 גרם) – אותו חישוב בדיוק כמו באפליקציה
const EXAMPLES = [
  { name: 'חזה עוף צלוי', grams: 100, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } },
  { name: 'שניצל עוף מטוגן', grams: 100, per100: { kcal: 270, protein: 19, carbs: 15, fat: 15, fiber: 1 } },
  { name: 'תפוח עץ', grams: 150, per100: { kcal: 60, protein: 0.8, carbs: 15, fat: 0.3, fiber: 2.4 } },
  { name: 'שוקולד (4 קוביות)', grams: 20, per100: { kcal: 540, protein: 7, carbs: 57, fat: 31, fiber: 4 } },
];

const n1 = (v) => formatBites(v);

// שלבי החישוב למאכל אחד, כמו שהם מוצגים על המסך
export function steps({ per100, grams }) {
  const kcal = kcalOf(per100);
  const protein = per100.protein || 0;
  const fiber = per100.fiber || 0;
  const net = Math.max(0, kcal - 3 * protein - 4 * fiber);
  const per100Bites = net / KCAL_PER_BITE;
  return { kcal, protein, fiber, net, per100Bites, total: bitesForGrams(per100, grams) };
}

function Steps({ food }) {
  const s = steps(food);
  return (
    <ol className="space-y-2 text-sm text-slate-700">
      <li>
        <b>1. קלוריות ל-100 גרם:</b> {n1(s.kcal)}
      </li>
      <li>
        <b>2. הנחה על חלבון:</b> {n1(s.protein)} גרם × 3 = <span dir="ltr" className="text-green-700">−{n1(3 * s.protein)}</span>
      </li>
      <li>
        <b>3. הנחה על סיבים:</b> {n1(s.fiber)} גרם × 4 = <span dir="ltr" className="text-green-700">−{n1(4 * s.fiber)}</span>
      </li>
      <li>
        <b>4. מה שנשאר:</b> {n1(s.kcal)} − {n1(3 * s.protein)} − {n1(4 * s.fiber)} = {n1(s.net)} קלוריות
      </li>
      <li>
        <b>5. לביסים:</b> {n1(s.net)} ÷ {KCAL_PER_BITE} = {n1(s.per100Bites)} ביסים ל-100 גרם
      </li>
      <li>
        <b>6. לפי המנה:</b> {n1(s.per100Bites)} × {food.grams} גרם ÷ 100 ={' '}
        <span className="font-black text-red-600 text-base">{n1(s.total)} ביסים</span>
      </li>
    </ol>
  );
}

export default function BitesExplainer() {
  const [pick, setPick] = useState(0);
  const [mine, setMine] = useState({ kcal: '', protein: '', fiber: '', grams: '100' });
  const num = (v) => Math.max(0, parseFloat(v) || 0);
  const myFood = { grams: num(mine.grams), per100: { kcal: num(mine.kcal), protein: num(mine.protein), fiber: num(mine.fiber) } };
  const myReady = myFood.per100.kcal > 0 && myFood.grams > 0;

  return (
    <Card className="space-y-4">
      <details>
        <summary className="cursor-pointer font-bold text-red-700 flex items-center gap-2">
          <Calculator size={18} /> איך מחושבים הביסים?
        </summary>

        <div className="mt-4 space-y-4">
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              <b>ביס אחד = {KCAL_PER_BITE} קלוריות.</b> חלבון וסיבים תזונתיים משביעים יותר, ולכן הם מקבלים הנחה: כל גרם חלבון
              מוריד 3 קלוריות, וכל גרם סיבים מוריד 4.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center font-bold text-red-800 leading-relaxed">
              ביסים ל-100 גרם = (קלוריות − 3 × חלבון − 4 × סיבים) ÷ {KCAL_PER_BITE}
            </div>
            <p>
              את התוצאה מכפילים לפי משקל המנה. התוצאה אף פעם לא יורדת מתחת ל-0. כשאין קלוריות על התווית, האפליקציה מחשבת אותן
              מהחלבון, הפחמימות והשומן.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">דוגמה:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={ex.name}
                  onClick={() => setPick(i)}
                  className={`px-3 py-1.5 rounded-full text-sm ${pick === i ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {ex.name}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-400 mb-2">
                {EXAMPLES[pick].name} · {EXAMPLES[pick].grams} גרם
              </p>
              <Steps food={EXAMPLES[pick]} />
            </div>
            <p className="text-xs text-slate-500">
              שימו לב: חזה עוף ושניצל באותו משקל, אבל לחזה העוף יש הרבה חלבון ופחות קלוריות, ולכן הוא שווה פחות ממחצית הביסים של השניצל.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-bold text-slate-700">נסו בעצמכם (מהתווית, ל-100 גרם):</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['kcal', 'קלוריות'],
                ['protein', 'חלבון (גרם)'],
                ['fiber', 'סיבים (גרם)'],
                ['grams', 'משקל המנה (גרם)'],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="mt-1"
                    value={mine[key]}
                    onChange={(e) => setMine({ ...mine, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {myReady ? (
              <div className="rounded-xl border border-slate-100 p-3">
                <Steps food={myFood} />
              </div>
            ) : (
              <p className="text-xs text-slate-400">ממלאים קלוריות ומשקל, והחישוב מופיע כאן שלב אחרי שלב.</p>
            )}
          </div>
        </div>
      </details>
    </Card>
  );
}
