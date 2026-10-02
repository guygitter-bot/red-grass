import { useState } from 'react';
import { Copy, Download, KeyRound, Upload } from 'lucide-react';
import { Button, Card, ErrorBox, Input, Label } from './ui';
import { MODELS, aiReady, describeError, testApiKey } from '../lib/ai';
import { inviteLink } from '../lib/proxy';
import FoodDbManager from './FoodDbManager';

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

export default function SettingsView({
  user, setUser, settings, setSettings, proxyUrl, foodDb, userFoods, saveFood, removeUserFood, exportData, importData,
}) {
  const [keyStatus, setKeyStatus] = useState('');
  const [keyError, setKeyError] = useState('');

  const ai = { ...settings, proxyUrl };
  const [showKey, setShowKey] = useState(Boolean(settings.apiKey));
  const [copied, setCopied] = useState(false);

  const copyInvite = async () => {
    const link = inviteLink(settings.accessCode);
    try {
      if (navigator.share) await navigator.share({ title: 'ביס', url: link });
      else await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // המשתמש ביטל את השיתוף
    }
  };

  const test = async () => {
    setKeyStatus('בודק...');
    setKeyError('');
    try {
      await testApiKey(ai);
      setKeyStatus(settings.apiKey ? 'המפתח תקין ✓' : 'מחובר לשרת המשותף ✓');
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
        {proxyUrl ? (
          <>
            <p className="text-xs text-slate-500">
              הסוכן עובד דרך השרת המשותף, עם מפתח ה-API של מנהל האפליקציה. צריך רק קוד גישה - מי שנכנס מקישור ההזמנה מקבל אותו
              אוטומטית. כל מכשיר שומר יומן וניקוד משלו.
            </p>
            <Input
              dir="ltr"
              placeholder="קוד גישה"
              value={settings.accessCode || ''}
              onChange={(e) => setSettings({ ...settings, accessCode: e.target.value.trim() })}
            />
            {settings.accessCode && (
              <Button variant="outline" className="w-full py-2" onClick={copyInvite}>
                <Copy size={16} /> {copied ? 'הקישור הועתק / נשלח' : 'שלח קישור הזמנה (כולל הקוד)'}
              </Button>
            )}
            <button className="text-xs text-slate-400 underline" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'הסתר מפתח אישי' : 'מפתח API אישי (לא חובה)'}
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            מפתח API של Anthropic (מ-console.anthropic.com). המפתח נשמר רק במכשיר הזה ולא נכלל בקובץ הגיבוי. כל צילום / חיפוש
            עולה כמה סנטים.
          </p>
        )}
        {(!proxyUrl || showKey) && (
          <Input
            type="password"
            dir="ltr"
            placeholder="sk-ant-..."
            value={settings.apiKey || ''}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
          />
        )}
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
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.autoAgent !== false}
            onChange={(e) => setSettings({ ...settings, autoAgent: e.target.checked })}
          />
          <span>
            הוספה אוטומטית: כשמחפשים מאכל שלא נמצא במאגר, הסוכן מחפש אותו ברשת ומוסיף אותו למאגר עם ניקוד, בלי ללחוץ על
            כלום.
          </span>
        </label>
        <Button variant="secondary" className="w-full" onClick={test} disabled={!aiReady(ai)}>
          בדוק חיבור
        </Button>
        {keyStatus && <p className="text-sm text-center text-emerald-600">{keyStatus}</p>}
        <ErrorBox>{keyError}</ErrorBox>
      </Card>

      <FoodDbManager foodDb={foodDb} userFoods={userFoods} saveFood={saveFood} removeUserFood={removeUserFood} />

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
