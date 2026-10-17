import { useState } from 'react';
import { Calculator, Leaf, ThumbsUp, Zap } from 'lucide-react';
import { Card, Input, Label } from './ui';
import { KCAL_PER_BITE, bitesForGrams, formatBites, kcalOf, withComputedBites } from '../lib/bites';
import { SHARED_FOODS, findByName } from '../lib/foodDb';

// דוגמאות מהמאגר המובנה (ערכים ל-100 גרם) – אותו חישוב בדיוק כמו באפליקציה
const EXAMPLES = [
  { name: 'חזה עוף צלוי', grams: 100, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } },
  { name: 'שניצל עוף מטוגן', grams: 100, per100: { kcal: 270, protein: 19, carbs: 15, fat: 15, fiber: 1 } },
  { name: 'תפוח עץ', grams: 150, per100: { kcal: 60, protein: 0.8, carbs: 15, fat: 0.3, fiber: 2.4 } },
  { name: 'שוקולד (4 קוביות)', grams: 20, per100: { kcal: 540, protein: 7, carbs: 57, fat: 31, fiber: 4 } },
];

const n1 = (v) => formatBites(v);

// "כמה ביסים במנה?" – מאכלים מהמאגר המובנה (כמו במצגת), מחושבים באותה נוסחה
const COMPARE = [
  ['ירקות (מנה, 150 ג\')', 'עגבנייה / מלפפון / בצל / גזר / חסה'],
  ['פרוסת לחם', 'לחם רגיל / אחיד / מלא (פרוסה)'],
  ['ביצה', 'ביצה קשה / ביצה עין / חביתה'],
  ['חזה עוף (100 ג\')', "חזה עוף צלוי / לפני בישול (100 ג')"],
  ['תפוח', 'תפוח עץ / בננה / אגס / קלמנטינה / תפוז'],
  ['כף שמן זית', 'שמן זית / קנולה (כף)'],
  ['שקית במבה קטנה', "במבה / חטיף בוטנים (שקית 25 ג')"],
  ['פיתה', 'פיתה רגילה'],
  ['פלאפל בפיתה', 'פלאפל בפיתה (כולל ירקות וטחינה)'],
]
  .map(([label, name]) => {
    const food = findByName(SHARED_FOODS, name);
    return food ? { label, bites: withComputedBites(food).points } : null;
  })
  .filter(Boolean);

const WHY = [
  { icon: Zap, color: 'text-orange-500', title: 'אנרגיה היא הבסיס', text: 'קלוריות הן מה שבסוף קובע. 35 קלוריות לביס נותן מספרים נוחים: פרוסת לחם בערך 2, פיתה בערך 7.' },
  { icon: ThumbsUp, color: 'text-green-600', title: 'חלבון משביע', text: 'ההנחה על חלבון מעודדת לבחור עוף, דגים, ביצים ומוצרי חלב דלים.' },
  { icon: Leaf, color: 'text-green-600', title: 'סיבים ממלאים', text: 'ירקות, דגנים מלאים וקטניות מקבלים פחות ביסים, כי הם ממלאים יותר.' },
];

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
          <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-white p-4 space-y-1">
            <p className="text-2xl font-black">ביס אחד = {KCAL_PER_BITE} קלוריות</p>
            <p className="text-sm text-red-50">ועל כל מה שמשביע, כמו חלבון וסיבים, מקבלים הנחה.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">הנוסחה, חלק אחרי חלק (לכל 100 גרם):</p>
            <div className="flex items-stretch gap-1.5 text-center">
              <div className="flex-1 rounded-xl bg-slate-800 text-white p-2">
                <p className="font-black">קלוריות</p>
                <p className="text-[11px] text-slate-300">הבסיס: כמה אנרגיה</p>
              </div>
              <span className="self-center font-bold text-slate-400">−</span>
              <div className="flex-1 rounded-xl bg-green-50 border border-green-300 p-2">
                <p className="font-black text-green-800">3 × חלבון</p>
                <p className="text-[11px] text-slate-500">הנחה על חלבון</p>
              </div>
              <span className="self-center font-bold text-slate-400">−</span>
              <div className="flex-1 rounded-xl bg-green-50 border border-green-300 p-2">
                <p className="font-black text-green-800">4 × סיבים</p>
                <p className="text-[11px] text-slate-500">הנחה על סיבים</p>
              </div>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-300 p-2 text-center">
              <p className="font-black text-orange-800">ומחלקים ב-{KCAL_PER_BITE} ← ביסים</p>
              <p className="text-[11px] text-slate-500">לא יורדים מתחת ל-0. אחר כך מכפילים לפי גודל המנה.</p>
            </div>
            <p className="text-xs text-slate-500">
              אין קלוריות על התווית? האפליקציה מחשבת אותן לבד: 4 לכל גרם חלבון ופחמימות, 9 לכל גרם שומן.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">למה דווקא ככה?</p>
            {WHY.map(({ icon: Icon, color, title, text }) => (
              <div key={title} className="flex gap-3 items-start rounded-xl border border-slate-100 p-3">
                <Icon size={22} className={`${color} shrink-0 mt-0.5`} />
                <div>
                  <p className="font-bold text-slate-700 text-sm">{title}</p>
                  <p className="text-xs text-slate-500">{text}</p>
                </div>
              </div>
            ))}
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
              בלי ההנחה על החלבון, 100 גרם חזה עוף היו יוצאים כמעט 5 ביסים, ולא 2.1. ככה השיטה מתגמלת אוכל משביע.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">כמה ביסים במנה?</p>
            {COMPARE.map(({ label, bites }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 text-slate-600">{label}</span>
                <div className="flex-1 h-4">
                  <div
                    className={`h-4 rounded ${bites <= 2.5 ? 'bg-green-500' : bites < 10 ? 'bg-orange-400' : 'bg-red-600'}`}
                    style={{ width: `${Math.max(3, (bites / Math.max(...COMPARE.map((c) => c.bites))) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-left font-bold text-slate-700">{n1(bites)}</span>
              </div>
            ))}
            <p className="text-xs text-slate-400">ערכים כלליים בקירוב. ירוק = עד 2.5 ביסים. המספר המדויק תלוי במוצר ובגודל המנה.</p>
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
