import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { GRAM_UNIT, portionPoints } from '../lib/measures';
import { formatQty } from '../lib/points';

// לכל מידה (כף, כפית, כוס...) כפתורי פלוס/מינוס, ואפשר לשלב: "כף + 2 כפית".
// או להזין גרמים מדויקים במקום. onChange({ grams, points, label, parts })
export default function MeasurePicker({ per100, units, onChange }) {
  const measures = units.filter((u) => u.name !== GRAM_UNIT.name);
  const unitsKey = JSON.stringify(measures);
  const [counts, setCounts] = useState(() => measures.map((_, i) => (i === 0 ? 1 : 0)));
  // כמה גרם יש במידה - אפשר לתקן (למשל הכף שלך שוקלת 7 ג')
  const [unitGrams, setUnitGrams] = useState(() => measures.map((u) => u.grams));
  const [gramsText, setGramsText] = useState('');

  useEffect(() => {
    setCounts(measures.map((_, i) => (i === 0 ? 1 : 0)));
    setUnitGrams(measures.map((u) => u.grams));
  }, [unitsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const exactGrams = parseFloat(gramsText);
  const byGrams = exactGrams > 0;
  const parts = measures
    .map((u, i) => ({ unitName: u.name, count: counts[i] || 0, grams: (counts[i] || 0) * (unitGrams[i] || 0) }))
    .filter((p) => p.count > 0);
  const grams = byGrams ? exactGrams : parts.reduce((s, p) => s + p.grams, 0);
  const points = portionPoints(per100, grams);
  const label = byGrams
    ? `${Math.round(exactGrams)} ג'`
    : parts.length
      ? `${parts.map((p) => `${p.count === 1 ? '' : `${formatQty(p.count)} `}${p.unitName}`).join(' + ')} (${Math.round(grams)} ג')`
      : '';

  useEffect(() => {
    onChange?.({ grams, points, label, parts: byGrams ? [] : parts });
  }, [grams, points, label]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (i, delta) => {
    setGramsText('');
    setCounts(counts.map((c, j) => (j === i ? Math.max(0, Math.round((c + delta) * 2) / 2) : c)));
  };

  return (
    <div className="space-y-2">
      {measures.map((u, i) => (
        <div key={`${u.name}-${i}`} className={`flex items-center gap-2 ${byGrams ? 'opacity-40' : ''}`}>
          <span className="w-12 text-sm font-medium text-slate-700">{u.name}</span>
          <button
            onClick={() => change(i, -1)}
            disabled={!counts[i]}
            className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-30"
            aria-label={`פחות ${u.name}`}
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center font-bold text-lg">{formatQty(counts[i] || 0)}</span>
          <button
            onClick={() => change(i, 1)}
            className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center"
            aria-label={`עוד ${u.name}`}
          >
            <Plus size={16} />
          </button>
          <button onClick={() => change(i, 0.5)} className="px-2 h-9 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">
            +½
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-400 mr-auto">
            =
            <input
              type="number"
              inputMode="decimal"
              value={unitGrams[i] ?? ''}
              onChange={(e) => setUnitGrams(unitGrams.map((g, j) => (j === i ? parseFloat(e.target.value) || 0 : g)))}
              className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center"
              aria-label={`גרם ל${u.name}`}
            />
            ג'{u.generic ? '*' : ''}
          </label>
        </div>
      ))}
      {measures.some((u) => u.generic) && (
        <p className="text-[11px] text-slate-400">* הערכה כללית לכל מאכל. אפשר לתקן כמה גרם יש בכף / בכפית.</p>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
        או בגרמים:
        <input
          type="number"
          inputMode="decimal"
          placeholder="למשל 30"
          value={gramsText}
          onChange={(e) => setGramsText(e.target.value)}
          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center"
        />
        ג'
      </label>
      <p className="text-sm font-bold text-emerald-700">{grams > 0 ? `${label} = ${points} נק'` : 'בחר/י כמות'}</p>
    </div>
  );
}
