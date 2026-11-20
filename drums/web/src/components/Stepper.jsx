// בורר מספר עם פלוס ומינוס (לבונה הסטים)
export default function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-2" dir="ltr">
        <button type="button" className="btn w-11 !px-0" aria-label={`פחות ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="lcd w-9 text-center font-bold text-lg tabular-nums py-0.5">{value}</span>
        <button type="button" className="btn w-11 !px-0" aria-label={`עוד ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}
