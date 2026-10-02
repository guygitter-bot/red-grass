import { PORTION_PRESETS, formatQty } from '../lib/points';

// בחירת כמות: חצי, רבע, 2 יחידות... או מספר חופשי.
export default function PortionPicker({ value, onChange, unitLabel = 'מנה' }) {
  const isPreset = PORTION_PRESETS.some((p) => Math.abs(p - value) < 1e-6);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PORTION_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-11 px-2.5 py-1.5 rounded-lg text-sm font-bold ${
              Math.abs(p - value) < 1e-6 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {formatQty(p)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>כמות אחרת:</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0"
          value={isPreset ? '' : value}
          placeholder={formatQty(value)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v > 0) onChange(v);
          }}
          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center"
        />
        <span>× {unitLabel}</span>
      </div>
    </div>
  );
}
