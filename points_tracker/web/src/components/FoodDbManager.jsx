import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Card, Input } from './ui';
import { normalize, searchFoods } from '../lib/foodDb';
import { formatPoints } from '../lib/points';

const FILTERS = [
  { id: 'all', label: 'הכול' },
  { id: 'manual', label: 'ידני' },
  { id: 'agent', label: 'הסוכן' },
];

const isManual = (f) => f.source === 'user' || f.source === 'ai';

function Badge({ food }) {
  if (food.source === 'agent')
    return (
      <span className="text-[10px] bg-violet-100 text-violet-600 rounded px-1.5 py-0.5 flex items-center gap-0.5">
        <Sparkles size={10} /> סוכן
      </span>
    );
  if (isManual(food)) return <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">ידני</span>;
  return null;
}

function FoodLine({ food, canDelete, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(food.name);
  const [points, setPoints] = useState(String(food.points));

  if (editing) {
    return (
      <div className="flex items-center gap-1 py-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="py-1.5 text-sm" />
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="w-16 py-1.5 text-sm text-center"
        />
        <button
          className="p-2 text-emerald-600 disabled:opacity-30"
          disabled={!name.trim() || points === ''}
          onClick={() => {
            onSave({ ...food, name: name.trim(), points: parseFloat(points), source: 'user' }, food.name);
            setEditing(false);
          }}
          aria-label="שמור"
        >
          <Check size={18} />
        </button>
        <button className="p-2 text-slate-400" onClick={() => setEditing(false)} aria-label="ביטול">
          <X size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm py-1.5 border-b border-slate-50">
      <span className="flex-1 min-w-0 truncate">{food.name}</span>
      <Badge food={food} />
      <span className="font-bold text-emerald-600 w-10 text-center">{formatPoints(food.points)}</span>
      <button onClick={() => setEditing(true)} className="text-slate-300 hover:text-emerald-600 p-1" aria-label="ערוך">
        <Pencil size={14} />
      </button>
      {canDelete && (
        <button onClick={() => onDelete(food.name)} className="text-red-300 hover:text-red-500 p-1" aria-label="מחק">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ניהול המאגר: הוספה ועריכה ידנית, בנפרד ממה שהסוכן מוסיף.
export default function FoodDbManager({ foodDb, userFoods, saveFood, removeUserFood }) {
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');

  const localNames = useMemo(() => new Set(userFoods.map((f) => normalize(f.name))), [userFoods]);
  const shown = useMemo(() => {
    let list = query ? searchFoods(foodDb, query, 200) : [...foodDb].reverse();
    if (filter === 'manual') list = list.filter(isManual);
    if (filter === 'agent') list = list.filter((f) => f.source === 'agent');
    return list.slice(0, 60);
  }, [foodDb, query, filter]);

  const add = () => {
    saveFood({ name: name.trim(), points: parseFloat(points), source: 'user' });
    setMsg(`"${name.trim()}" נוסף למאגר`);
    setName('');
    setPoints('');
  };

  return (
    <Card className="space-y-3">
      <h3 className="font-bold">מאגר המאכלים ({foodDb.length})</h3>
      <p className="text-xs text-slate-500">
        מוסיפים כאן מאכל וניקוד ידנית. הסוכן מוסיף מאכלים בעצמו (מסומנים "סוכן"), ולעולם לא דורס מאכל שהוספת ידנית.
      </p>

      <div className="flex gap-2">
        <Input placeholder="שם המאכל (למשל: חטיף חלבון (יחידה))" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          placeholder="נק'"
          className="w-20 text-center"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
      </div>
      <Button className="w-full py-2" disabled={!name.trim() || points === ''} onClick={add}>
        <Plus size={18} /> הוסף למאגר
      </Button>
      {msg && <p className="text-xs text-center text-emerald-600">{msg}</p>}

      <div className="pt-2 space-y-2">
        <Input placeholder="חיפוש במאגר..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                filter === f.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {shown.map((f) => (
            <FoodLine
              key={f.name}
              food={f}
              canDelete={localNames.has(normalize(f.name))}
              onSave={saveFood}
              onDelete={removeUserFood}
            />
          ))}
          {shown.length === 0 && <p className="text-center text-sm text-slate-400 py-4">אין מאכלים</p>}
        </div>
      </div>
    </Card>
  );
}
