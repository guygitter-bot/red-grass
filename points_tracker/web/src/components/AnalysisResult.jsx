import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui';
import PortionPicker from './PortionPicker';
import { scoreComponents } from '../lib/ai';
import { formatPoints, pointsForGrams, round1 } from '../lib/points';

const CONFIDENCE = { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך - כדאי לבדוק' };

// תוצאת ניתוח של צילום / טקסט / מתכון: רכיבים שאפשר לתקן, מספר מנות וכמה אכלת.
export default function AnalysisResult({ analysis, db, onAdd }) {
  const initial = useMemo(() => scoreComponents(analysis.components, db), [analysis, db]);
  const [grams, setGrams] = useState(() => initial.map((c) => c.grams));
  const [removed, setRemoved] = useState(() => initial.map(() => false));
  const [servings, setServings] = useState(analysis.servings);
  const [portion, setPortion] = useState(1);
  const [name, setName] = useState(analysis.dish_name);
  const [saveToDb, setSaveToDb] = useState(analysis.servings > 1);

  const components = initial.map((c, i) => {
    const g = Number(grams[i]) || 0;
    const scale = c.grams > 0 ? g / c.grams : 0;
    const points = c.dbItem ? c.points * scale : pointsForGrams(c.per100, g);
    return { ...c, grams: g, points: round1(points), removed: removed[i] };
  });
  const total = components.filter((c) => !c.removed).reduce((s, c) => s + c.points, 0);
  const perServing = round1(total / (servings > 0 ? servings : 1));

  const add = () =>
    onAdd(
      {
        name: servings > 1 ? `${name} (מנה)` : name,
        points: perServing,
        qty: portion,
        parts: components.filter((c) => !c.removed).map((c) => `${c.amount} (${formatPoints(c.points)})`),
      },
      saveToDb,
    );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-lg font-bold bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-emerald-500"
        />
        <p className="text-xs text-slate-400">{CONFIDENCE[analysis.confidence]}</p>
        {analysis.notes_he && <p className="text-xs text-slate-500">{analysis.notes_he}</p>}
      </div>

      <div className="space-y-2">
        {components.map((c, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-xl border ${
              c.removed ? 'opacity-40 border-slate-100' : 'border-slate-200'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-xs text-slate-400 truncate">
                {c.amount}
                {c.dbItem ? ' · לפי המאגר' : ''}
              </div>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={grams[i]}
              onChange={(e) => setGrams(grams.map((g, j) => (j === i ? e.target.value : g)))}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1 text-center text-sm"
              aria-label="גרמים"
            />
            <span className="text-xs text-slate-400">ג'</span>
            <span className="w-10 text-center font-bold text-emerald-600">{formatPoints(c.points)}</span>
            <button
              onClick={() => setRemoved(removed.map((r, j) => (j === i ? !r : r)))}
              className="text-slate-300 hover:text-red-500 p-1"
              aria-label="הסר רכיב"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 text-sm">
        <span>
          סה"כ <b>{formatPoints(total)}</b> נק'
        </span>
        <label className="flex items-center gap-2">
          מספר מנות:
          <input
            type="number"
            inputMode="decimal"
            min="1"
            value={servings}
            onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
            className="w-14 bg-white border border-slate-200 rounded-lg px-1 py-1 text-center"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-700">
          כמה אכלת? <span className="font-normal text-slate-500">(מנה = {formatPoints(perServing)} נק')</span>
        </p>
        <PortionPicker value={portion} onChange={setPortion} unitLabel="מנה" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={saveToDb} onChange={(e) => setSaveToDb(e.target.checked)} />
        שמור את המאכל במאגר שלי לפעם הבאה
      </label>

      <Button onClick={add} className="w-full" disabled={!name}>
        <Plus size={18} /> הוסף לצלחת · {formatPoints(perServing * portion)} נק'
      </Button>
    </div>
  );
}
