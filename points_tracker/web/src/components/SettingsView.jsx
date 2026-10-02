import { useState } from 'react';
import { Download, KeyRound, Upload } from 'lucide-react';
import { Button, Card, ErrorBox, Input, Label } from './ui';
import { MODELS, aiReady, describeError, testApiKey } from '../lib/ai';
import InviteManager from './InviteManager';
import { parseInviteToken } from '../lib/proxy';
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
  user, setUser, settings, setSettings, proxyUrl, owner, onJoin, foodDb, userFoods, saveFood, removeUserFood, remoteFoods, sharedOn, isAdmin,
  exportData, importData,
}) {
  const [keyStatus, setKeyStatus] = useState('');
  const [keyError, setKeyError] = useState('');

  const ai = { ...settings, proxyUrl };
  const [showKey, setShowKey] = useState(Boolean(settings.apiKey));
  const invited = Boolean(settings.deviceKey) && !owner;
  const [inviteText, setInviteText] = useState('');
  const [joinError, setJoinError] = useState('');
  const join = async () => {
    const token = parseInviteToken(inviteText);
    if (!token) return setJoinError('זה לא נראה כמו קישור הזמנה. העתק/י את כל הקישור שקיבלת.');
    setJoinError('');
    if (await onJoin(token)) setInviteText('');
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

      {proxyUrl && !owner && !invited && (
        <Card className="space-y-3 border-violet-100">
          <div className="space-y-2">
            <p className="text-sm font-bold text-violet-700">יש לך קישור הזמנה?</p>
            <p className="text-xs text-slate-500">הדבק/י כאן את הקישור שקיבלת כדי לחבר את המכשיר הזה.</p>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="https://bis-app.pages.dev/#invite=..."
                value={inviteText}
                onChange={(e) => setInviteText(e.target.value)}
                className="bg-white text-xs"
              />
              <Button variant="ai" className="px-4 py-2" onClick={join} disabled={!inviteText.trim()}>
                התחבר
              </Button>
            </div>
            <ErrorBox>{joinError}</ErrorBox>
          </div>
          <details className="text-xs text-slate-500" open={Boolean(settings.accessCode)}>
            <summary className="cursor-pointer text-slate-400 underline">בעל האפליקציה? כניסה עם קוד</summary>
            <Input
              dir="ltr"
              type="password"
              placeholder="קוד גישה"
              className="mt-2"
              value={settings.accessCode || ''}
              onChange={(e) => setSettings({ ...settings, accessCode: e.target.value.trim() })}
            />
            {settings.accessCode && <p className="mt-1 text-slate-400">בודק את הקוד... אם הוא נכון, הגדרות הבעלים יופיעו כאן.</p>}
          </details>
        </Card>
      )}

      {/* הגדרות הסוכן: רק לבעל האפליקציה (או כשאין שרת משותף ומשתמשים במפתח אישי). משתמש שהוזמן לא רואה אותן. */}
      {(owner || !proxyUrl) && (
        <Card className="space-y-3 border-violet-100">
          <h3 className="font-bold text-violet-700 flex items-center gap-2">
            <KeyRound size={18} /> הסוכן החכם (צילום, מרכיבים, חיפוש ברשת)
          </h3>
          {proxyUrl ? (
            <>
              <p className="text-xs text-slate-500">
                הסוכן עובד דרך השרת המשותף, עם מפתח ה-API של בעל האפליקציה. מצטרפים דרך קישור הזמנה חד-פעמי. כל מכשיר שומר
                יומן וניקוד משלו.
              </p>
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-400 underline">קוד גישה (רק לבעל האפליקציה)</summary>
                <Input
                  dir="ltr"
                  type="password"
                  placeholder="קוד גישה"
                  className="mt-2"
                  value={settings.accessCode || ''}
                  onChange={(e) => setSettings({ ...settings, accessCode: e.target.value.trim() })}
                />
              </details>
              {owner && <InviteManager settings={ai} />}
              {owner && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-400 underline">קוד מנהל (רק למנהל האפליקציה)</summary>
                <p className="my-2">עם קוד המנהל, עריכה ומחיקה של מאכל במאגר המשותף משפיעות על כולם.</p>
                <Input
                  dir="ltr"
                  type="password"
                  placeholder="קוד מנהל"
                  value={settings.adminCode || ''}
                  onChange={(e) => setSettings({ ...settings, adminCode: e.target.value.trim() })}
                />
              </details>
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
      )}

      <FoodDbManager
        foodDb={foodDb}
        userFoods={userFoods}
        remoteFoods={remoteFoods}
        sharedOn={sharedOn}
        isAdmin={isAdmin}
        saveFood={saveFood}
        removeUserFood={removeUserFood}
      />

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
