import { useEffect, useState } from 'react';
import { GRAM_UNIT, portionLabel, portionPoints } from '../lib/measures';
import { formatQty } from '../lib/points';

const COUNTS = [0.25, 0.5, 1, 1.5, 2, 3];

// בוחרים מידה (גרם / כף / כפית / כוס / יחידה...) וכמות, ומקבלים גרמים ונקודות למנה.
// onChange({ grams, points, label, unitName, count })
export default function MeasurePicker({ per100, units, onChange }) {
  const [unitIndex, setUnitIndex] = useState(units.length > 1 ? 1 : 0);
  const [count, setCount] = useState(1);
  const [gramsText, setGramsText] = useState('100');
  // אפשר לתקן כמה גרם יש במידה (למשל כף שלך שוקלת 7 ג')
  const [unitGrams, setUnitGrams] = useState(() => units.map((u) => u.grams));

  const unitsKey = JSON.stringify(units);
  useEffect(() => {
    setUnitGrams(units.map((u) => u.grams));
    setUnitIndex((i) => Math.min(i, units.length - 1));
  }, [unitsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const unit = units[unitIndex] || GRAM_UNIT;
  const isGrams = unit.name === GRAM_UNIT.name;
  const grams = isGrams ? parseFloat(gramsText) || 0 : (unitGrams[unitIndex] || 0) * count;
  const points = portionPoints(per100, grams);
  const label = portionLabel(unit, count, grams);

  useEffect(() => {
    onChange?.({ grams, points, label, unitName: unit.name, count: isGrams ? 1 : count });
  }, [grams, points, label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {units.map((u, i) => (
          <button
            key={`${u.name}-${i}`}
            onClick={() => setUnitIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              i === unitIndex ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {isGrams ? (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          כמה גרם?
          <input
            type="number"
            inputMode="decimal"
            value={gramsText}
            onChange={(e) => setGramsText(e.target.value)}
            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center"
          />
          ג'
        </label>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 items-center">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`min-w-10 px-2.5 py-1.5 rounded-lg text-sm font-bold ${
                  Math.abs(c - count) < 1e-6 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {formatQty(c)}
              </button>
            ))}
            <input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0"
              placeholder="אחר"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (v > 0) setCount(v);
              }}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {unit.name} אחת =
            <input
              type="number"
              inputMode="decimal"
              value={unitGrams[unitIndex] ?? ''}
              onChange={(e) => setUnitGrams(unitGrams.map((g, i) => (i === unitIndex ? parseFloat(e.target.value) || 0 : g)))}
              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-center"
            />
            ג'{unit.generic ? ' (הערכה כללית - אפשר לתקן)' : ''}
          </label>
        </>
      )}
      <p className="text-sm font-bold text-emerald-700">
        {label} = {points} נק'
      </p>
    </div>
  );
}
