// מחלקות Tailwind מלאות (לא מחרוזות מורכבות) – כדי שייכנסו לבנייה
export const COLOR_CLASSES = {
  rose: { soft: 'bg-rose-100 text-rose-700', solid: 'bg-rose-500', bar: 'bg-rose-400' },
  orange: { soft: 'bg-orange-100 text-orange-700', solid: 'bg-orange-500', bar: 'bg-orange-400' },
  amber: { soft: 'bg-amber-100 text-amber-700', solid: 'bg-amber-500', bar: 'bg-amber-400' },
  lime: { soft: 'bg-lime-100 text-lime-700', solid: 'bg-lime-500', bar: 'bg-lime-400' },
  emerald: { soft: 'bg-emerald-100 text-emerald-700', solid: 'bg-emerald-500', bar: 'bg-emerald-400' },
  teal: { soft: 'bg-teal-100 text-teal-700', solid: 'bg-teal-500', bar: 'bg-teal-400' },
  sky: { soft: 'bg-sky-100 text-sky-700', solid: 'bg-sky-500', bar: 'bg-sky-400' },
  indigo: { soft: 'bg-indigo-100 text-indigo-700', solid: 'bg-indigo-500', bar: 'bg-indigo-400' },
  violet: { soft: 'bg-violet-100 text-violet-700', solid: 'bg-violet-500', bar: 'bg-violet-400' },
  fuchsia: { soft: 'bg-fuchsia-100 text-fuchsia-700', solid: 'bg-fuchsia-500', bar: 'bg-fuchsia-400' },
};

export function colorOf(name) {
  return COLOR_CLASSES[name] || COLOR_CLASSES.violet;
}
