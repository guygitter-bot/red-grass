import { useEffect, useMemo, useState } from 'react';
import { Calculator, PieChart, Plus, Settings, TrendingDown } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AddFoodSheet from './components/AddFoodSheet';
import CalculatorView from './components/CalculatorView';
import WeightView from './components/WeightView';
import SettingsView from './components/SettingsView';
import { usePersistentState, loadJson, newId } from './lib/storage';
import { addDays, formatDisplayDate, today, weekDates } from './lib/dates';
import { SHARED_FOODS, extractUserFoods, findByName, mergeFoodDb, normalize, upsertUserFood } from './lib/foodDb';
import { addSharedFood, adminDeleteFood, adminUpdateFood, fetchSharedFoods, sharedAvailable } from './lib/sharedFoods';
import { DEFAULT_MODEL } from './lib/ai';
import { loadProxyUrl, redeemInvite, takeInviteToken } from './lib/proxy';

const DEFAULT_USER = { name: 'אורח', dailyTarget: 26, weeklyTarget: 35, startWeight: 80, currentWeight: 80, goalWeight: 70 };

// גרסה קודמת שמרה את כל המאגר תחת pointsApp_foodDb - שומרים רק מה שהמשתמש הוסיף.
function initialUserFoods() {
  const old = loadJson('pointsApp_foodDb', null);
  return old ? extractUserFoods(old, SHARED_FOODS) : [];
}

const sumPoints = (logs) => logs.reduce((s, l) => s + (Number(l.points) || 0), 0);

export default function App() {
  const [view, setView] = useState('dashboard');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

  const [user, setUser] = usePersistentState('pointsApp_user', DEFAULT_USER);
  const [logs, setLogs] = usePersistentState('pointsApp_logs', []);
  const [waterLogs, setWaterLogs] = usePersistentState('pointsApp_waterLogs', {});
  const [weightHistory, setWeightHistory] = usePersistentState('pointsApp_weights', () => [
    { date: new Date().toISOString(), weight: DEFAULT_USER.currentWeight },
  ]);
  const [userFoods, setUserFoods] = usePersistentState('pointsApp_userFoods', initialUserFoods);
  const [settings, setSettings] = usePersistentState('pointsApp_settings', { apiKey: '', model: DEFAULT_MODEL, autoAgent: true });


  // השרת המשותף + קוד הגישה מקישור ההזמנה: כך לא צריך להדביק מפתח בכל טלפון.
  const [proxyUrl, setProxyUrl] = useState('');
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    const urlReady = loadProxyUrl().then((url) => {
      setProxyUrl(url);
      return url;
    });
    // קישור הזמנה חד-פעמי: מקבלים מהשרת מפתח מכשיר קבוע, והקישור מפסיק לעבוד.
    const applyInvite = async () => {
      const token = takeInviteToken();
      if (!token) return;
      const url = await urlReady;
      if (!url) return setNotice({ ok: false, text: 'השרת לא זמין כרגע. נסה/י לפתוח את הקישור שוב מאוחר יותר.' });
      try {
        const { deviceKey } = await redeemInvite(url, token);
        setSettings((s) => ({ ...s, deviceKey }));
        setNotice({ ok: true, text: 'ההזמנה התקבלה ✓ הסוכן החכם מחובר במכשיר הזה.' });
      } catch (err) {
        setNotice({ ok: false, text: err.message });
      }
    };
    applyInvite();
    // גם כשהאפליקציה כבר פתוחה ונפתח בה קישור הזמנה
    window.addEventListener('hashchange', applyInvite);
    return () => window.removeEventListener('hashchange', applyInvite);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const aiSettings = useMemo(() => ({ ...settings, proxyUrl }), [settings, proxyUrl]);

  // המאגר המשותף בשרת (מה שכל המשתמשים הוסיפו). נשמר גם במכשיר לשימוש בלי אינטרנט.
  const [remoteFoods, setRemoteFoods] = usePersistentState('pointsApp_sharedFoods', []);
  // מאכלים משותפים שהמשתמש מחק אצלו בלבד
  const [hiddenFoods, setHiddenFoods] = usePersistentState('pointsApp_hiddenFoods', []);
  const sharedOn = sharedAvailable(aiSettings);
  const isAdmin = sharedOn && Boolean(settings.adminCode);
  const refreshShared = () => {
    if (sharedAvailable(aiSettings)) fetchSharedFoods(aiSettings).then(setRemoteFoods).catch(() => {});
  };
  useEffect(() => {
    refreshShared();
    const onVisible = () => document.visibilityState === 'visible' && refreshShared();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [proxyUrl, settings.accessCode, settings.deviceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const foodDb = useMemo(() => {
    const base = [...SHARED_FOODS, ...remoteFoods.filter((f) => !findByName(SHARED_FOODS, f.name))];
    const hidden = new Set(hiddenFoods);
    return mergeFoodDb(base, userFoods).filter((f) => !hidden.has(normalize(f.name)));
  }, [remoteFoods, userFoods, hiddenFoods]);
  const inRemote = (name) => Boolean(name && findByName(remoteFoods, name));

  const dayLogs = useMemo(() => logs.filter((l) => l.date === selectedDate), [logs, selectedDate]);
  const dailyUsed = sumPoints(dayLogs);
  const weeklyLeft = useMemo(() => {
    const used = weekDates(selectedDate).reduce((s, d) => {
      const over = sumPoints(logs.filter((l) => l.date === d)) - user.dailyTarget;
      return s + Math.max(0, over);
    }, 0);
    return user.weeklyTarget - used;
  }, [logs, selectedDate, user.dailyTarget, user.weeklyTarget]);

  // מאכלים אחרונים לבחירה מהירה
  const recent = useMemo(() => {
    const seen = new Map();
    for (const log of logs) {
      const parts = log.components || [{ name: log.foodName, unitPoints: log.points }];
      for (const c of parts) if (!seen.has(c.name)) seen.set(c.name, { name: c.name, points: c.unitPoints });
      if (seen.size >= 6) break;
    }
    return [...seen.values()].slice(0, 6);
  }, [logs]);

  const addLog = (entry) => {
    setLogs((prev) => [{ id: newId(), date: selectedDate, ...entry }, ...prev]);
    setShowAdd(false);
  };

  // הוספה ידנית ואוטומטית (הסוכן) עובדות בנפרד: ידני גובר תמיד, והסוכן לעולם לא דורס מאכל שהוזן ידנית.
  // מאכל חדש נשמר במכשיר וגם נשלח למאגר המשותף, כך שכולם רואים אותו.
  // עריכה נשארת אישית - חוץ ממנהל, שעריכה שלו של מאכל משותף מתקנת אותו לכולם.
  const saveFood = (food, oldName) => {
    const clean = { ...food, added: today() };
    if (oldName !== undefined && isAdmin && inRemote(oldName)) {
      adminUpdateFood(aiSettings, clean, oldName).then(refreshShared).catch((e) => alert(e.message));
      return;
    }
    const isNew = oldName === undefined && !findByName(foodDb, food.name);
    setUserFoods((prev) => upsertUserFood(prev, clean, oldName));
    setHiddenFoods((prev) => prev.filter((n) => n !== normalize(food.name)));
    if (isNew && sharedOn) addSharedFood(aiSettings, clean).then(refreshShared).catch(() => {});
  };

  const removeFood = (name) => {
    if (isAdmin && inRemote(name)) {
      if (!confirm(`למחוק את "${name}" מהמאגר המשותף אצל כולם?`)) return;
      adminDeleteFood(aiSettings, name).then(refreshShared).catch((e) => alert(e.message));
    } else if (inRemote(name)) {
      setHiddenFoods((prev) => [...new Set([...prev, normalize(name)])]);
    }
    setUserFoods((prev) => prev.filter((f) => normalize(f.name) !== normalize(name)));
  };

  const water = waterLogs[selectedDate] || 0;
  const setWater = (n) => setWaterLogs((prev) => ({ ...prev, [selectedDate]: Math.max(0, n) }));

  const addWeight = (weight) => {
    setUser((u) => ({ ...u, currentWeight: weight }));
    setWeightHistory((h) => [...h, { date: new Date().toISOString(), weight }]);
  };
  const removeWeight = (idx) => {
    const next = weightHistory.filter((_, i) => i !== idx);
    setWeightHistory(next);
    setUser((u) => ({ ...u, currentWeight: next[next.length - 1].weight }));
  };

  const exportData = () => {
    const data = { version: 2, user, logs, weightHistory, userFoods, waterLogs };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bis-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const importData = (data) => {
    if (data.user) setUser(data.user);
    if (data.logs) setLogs(data.logs);
    if (data.weightHistory) setWeightHistory(data.weightHistory);
    if (data.waterLogs) setWaterLogs(data.waterLogs);
    if (data.userFoods) setUserFoods(data.userFoods);
    else if (data.foodDb) setUserFoods(extractUserFoods(data.foodDb, SHARED_FOODS));
  };

  const navButton = (id, Icon, label) => (
    <button
      onClick={() => setView(id)}
      className={`flex flex-col items-center gap-1 transition-colors ${view === id ? 'text-emerald-600' : 'hover:text-emerald-500'}`}
    >
      <Icon size={24} strokeWidth={view === id ? 2.5 : 2} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24" dir="rtl">
      <div className="max-w-md mx-auto p-4 pt-8">
        {notice && (
          <div
            className={`mb-4 rounded-xl p-3 text-sm flex justify-between items-start gap-2 ${
              notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}
          >
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="סגור" className="font-bold">
              ×
            </button>
          </div>
        )}
        {view === 'dashboard' && (
          <Dashboard
            user={user}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            changeDate={(n) => setSelectedDate((d) => addDays(d, n))}
            dayLogs={dayLogs}
            dailyUsed={dailyUsed}
            weeklyLeft={weeklyLeft}
            water={water}
            addWater={() => setWater(water + 1)}
            removeWater={() => setWater(water - 1)}
            removeLog={(id) => setLogs((prev) => prev.filter((l) => l.id !== id))}
            openAdd={() => setShowAdd(true)}
          />
        )}
        {view === 'calculator' && (
          <CalculatorView settings={aiSettings} onLog={addLog} onSaveFood={saveFood} goHome={() => setView('dashboard')} />
        )}
        {view === 'weight' && <WeightView user={user} history={weightHistory} addWeight={addWeight} removeWeight={removeWeight} />}
        {view === 'settings' && (
          <SettingsView
            user={user}
            setUser={setUser}
            settings={settings}
            setSettings={setSettings}
            proxyUrl={proxyUrl}
            foodDb={foodDb}
            userFoods={userFoods}
            saveFood={saveFood}
            removeUserFood={removeFood}
            remoteFoods={remoteFoods}
            sharedOn={sharedOn}
            isAdmin={isAdmin}
            exportData={exportData}
            importData={importData}
          />
        )}

        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center text-xs font-medium text-slate-400 z-40 max-w-md mx-auto shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          {navButton('dashboard', PieChart, 'יומן')}
          {navButton('calculator', Calculator, 'מחשבון')}
          <div className="relative -top-6">
            <button
              onClick={() => setShowAdd(true)}
              className="bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-200 hover:scale-105 transition-transform"
              aria-label="הוסף אוכל"
            >
              <Plus size={28} />
            </button>
          </div>
          {navButton('weight', TrendingDown, 'משקל')}
          {navButton('settings', Settings, 'הגדרות')}
        </nav>

        {showAdd && (
          <AddFoodSheet
            db={foodDb}
            recent={recent}
            settings={aiSettings}
            dateLabel={formatDisplayDate(selectedDate)}
            onLog={addLog}
            onSaveFood={saveFood}
            onClose={() => setShowAdd(false)}
          />
        )}
      </div>
    </div>
  );
}
