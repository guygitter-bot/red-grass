import { useState } from 'react';
import { Download, KeyRound, Trash2, Upload } from 'lucide-react';
import { Button, Card, ErrorBox, Input, Label } from './ui';
import { MODELS, describeError, testApiKey } from '../lib/ai';
import { formatPoints } from '../lib/points';

function NumberField({ label, value, onChange }) {
  const [text, setText] = useState(String(value ?? ''));
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        className="mt-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseFloat(text);
          if (v > 0) onChange(v);
          else setText(String(value));
        }}
      />
    </div>
  );
}

export default function SettingsView({ user, setUser, settings, setSettings, userFoods, removeUserFood, exportData, importData }) {
  const [keyStatus, setKeyStatus] = useState('');
  const [keyError, setKeyError] = useState('');
  const [foodFilter, setFoodFilter] = useState('');

  const test = async () => {
    setKeyStatus('בודק...');
    setKeyError('');
    try {
      await testApiKey(settings);
      setKeyStatus('המפתח תקין ✓');
    } catch (err) {
      setKeyStatus('');
      setKeyError(describeError(err));
    }
  };

  const onImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !confirm('פעולה זו תחליף את הנתונים הנוכחיים בנתונים מהקובץ. להמשיך?')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(JSON.parse(reader.result));
        alert('הנתונים שוחזרו בהצלחה!');
      } catch {
        alert('שגיאה בקריאת הקובץ. ודא שזהו קובץ גיבוי תקין.');
      }
    };
    reader.readAsText(file);
  };

  const shownFoods = userFoods.filter((f) => f.name.includes(foodFilter));

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold">הגדרות</h2>

      <Card className="space-y-4">
        <div>
          <Label>שם משתמש</Label>
          <Input className="mt-1" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="תקציב יומי" value={user.dailyTarget} onChange={(v) => setUser({ ...user, dailyTarget: v })} />
          <NumberField label="תקציב שבועי" value={user.weeklyTarget} onChange={(v) => setUser({ ...user, weeklyTarget: v })} />
          <NumberField label="משקל התחלתי" value={user.startWeight} onChange={(v) => setUser({ ...user, startWeight: v })} />
          <NumberField label="משקל יעד" value={user.goalWeight} onChange={(v) => setUser({ ...user, goalWeight: v })} />
        </div>
      </Card>

      <Card className="space-y-3 border-violet-100">
        <h3 className="font-bold text-violet-700 flex items-center gap-2">
          <KeyRound size={18} /> הסוכן החכם (צילום, מרכיבים, חיפוש ברשת)
        </h3>
        <p className="text-xs text-slate-500">
          מפתח API של Anthropic (מ-console.anthropic.com). המפתח נשמר רק במכשיר הזה, לא נכלל בקובץ הגיבוי, והבקשות נשלחות ישירות
          ל-Anthropic. כל צילום / חיפוש עולה כמה סנטים.
        </p>
        <Input
          type="password"
          dir="ltr"
          placeholder="sk-ant-..."
          value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
        />
        <select
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" className="w-full" onClick={test} disabled={!settings.apiKey}>
          בדוק מפתח
        </Button>
        {keyStatus && <p className="text-sm text-center text-emerald-600">{keyStatus}</p>}
        <ErrorBox>{keyError}</ErrorBox>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-bold">המאכלים שלי ({userFoods.length})</h3>
        <p className="text-xs text-slate-500">מאכלים שהוספת או שהסוכן מצא עבורך. המאגר המשותף מתעדכן אוטומטית מהסוכן ב-GitHub.</p>
        {userFoods.length > 5 && <Input placeholder="סינון..." value={foodFilter} onChange={(e) => setFoodFilter(e.target.value)} />}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {shownFoods.map((f) => (
            <div key={f.name} className="flex items-center justify-between text-sm py-1">
              <span className="flex-1 truncate">{f.name}</span>
              <span className="font-bold text-emerald-600 mx-2">{formatPoints(f.points)}</span>
              <button onClick={() => removeUserFood(f.name)} className="text-red-300 hover:text-red-500 p-1" aria-label="מחק">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-emerald-50 border-emerald-100 space-y-3">
        <h3 className="font-bold text-emerald-800">גיבוי ושחזור נתונים</h3>
        <p className="text-xs text-emerald-600">מומלץ לשמור גיבוי מדי פעם למקרה שתחליף טלפון או שהנתונים יימחקו.</p>
        <Button onClick={exportData} variant="outline" className="w-full bg-white text-emerald-700 border-emerald-200">
          <Download size={18} /> הורד קובץ גיבוי
        </Button>
        <label className="block">
          <input type="file" accept=".json,application/json" onChange={onImport} className="hidden" />
          <span className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-slate-100 text-slate-600 cursor-pointer">
            <Upload size={18} /> טען גיבוי מקובץ
          </span>
        </label>
      </Card>

      <Card className="bg-red-50 border-red-100">
        <h3 className="font-bold text-red-600 mb-2">אזור מסוכן</h3>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (confirm('האם אתה בטוח? כל הנתונים יימחקו לצמיתות ולא ניתן יהיה לשחזר אותם.')) {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('pointsApp_'))
                .forEach((k) => localStorage.removeItem(k));
              window.location.reload();
            }
          }}
        >
          איפוס כל הנתונים
        </Button>
      </Card>
    </div>
  );
}
