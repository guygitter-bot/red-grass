import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  PieChart,
  Calendar,
  Settings,
  Scale,
  Droplets,
  TrendingDown,
  Search,
  Download,
  Upload,
  ChevronRight,
  ChevronLeft,
  Calculator,
} from "lucide-react";

// --- רכיבים ועיצוב ---

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className}`}
  >
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  ...props
}) => {
  const baseStyle =
    "px-4 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary:
      "bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-600",
    secondary: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    danger: "bg-red-50 text-red-500 hover:bg-red-100",
    outline:
      "border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-500",
  };
  return (
    <button
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- מאגר נתונים התחלתי ---
const initialFoodDatabase = [
  { name: "עגבנייה / מלפפון / בצל / גזר / חסה", points: 0 },
  { name: "פטריות / פלפל / כרוב / ברוקולי / קישוא", points: 0 },
  { name: "תפוח עץ / בננה / אגס / קלמנטינה / תפוז", points: 2 },
  { name: "אבטיח פרוסה בינונית (250 ג')", points: 2 },
  { name: "מלון כוס (200 ג')", points: 2 },
  { name: "ענבים (12 יחידות)", points: 2 },
  { name: "רימון גרגירים (חצי כוס)", points: 2 },
  { name: "לחם קל / לחמניה קלה (פרוסה)", points: 1 },
  { name: "לחם רגיל / אחיד / מלא (פרוסה)", points: 2 },
  { name: "פיתה קלה", points: 2 },
  { name: "פיתה רגילה", points: 6 },
  { name: "לחמנייה רגילה", points: 6 },
  { name: "באגט שלם", points: 19 },
  { name: "אורז לבן / מלא אחרי בישול (כוס)", points: 5 },
  { name: "פסטה / אטריות אחרי בישול (כוס)", points: 7 },
  { name: "פתיתים אחרי בישול (כוס)", points: 7 },
  { name: "קינואה אחרי בישול (כוס)", points: 5 },
  { name: "בורגול אחרי בישול (כוס)", points: 4 },
  { name: "תפוח אדמה / בטטה (100 ג')", points: 2 },
  { name: "תירס גרעינים עם סוכר (כוס)", points: 5 },
  { name: "תירס קלח בינוני", points: 2 },
  { name: "חזה עוף צלוי / לפני בישול (100 ג')", points: 3 },
  { name: "פרגית שיפוד / פרוסה (80 ג')", points: 4 },
  { name: "שניצל עוף מטוגן ביתי (100 ג')", points: 8 },
  { name: "שניצל עוף דק / קנוי (100 ג')", points: 6 },
  { name: "שניצל תירס לייט (יחידה 70 ג')", points: 2 },
  { name: "שניצל תירס רגיל מן הצומח", points: 4 },
  { name: "בשר בקר טחון לפני בישול (100 ג')", points: 6 },
  { name: "קבב מזרחי (יחידה 50 ג')", points: 3 },
  { name: "סלמון אחרי בישול (100 ג')", points: 5 },
  { name: "דג אמנון / דניס אחרי בישול (100 ג')", points: 3 },
  { name: "טונה משומרת במים מסוננת (קופסה)", points: 2.5 },
  { name: "טונה משומרת בשמן מסוננת (קופסה)", points: 5 },
  { name: "ביצה קשה / ביצה עין / חביתה", points: 2 },
  { name: "קוטג' 5% / 3% (2 כפות)", points: 0.5 },
  { name: "קוטג' 5% (גביע שלם 250 ג')", points: 6 },
  { name: "גבינה לבנה 5% (כף)", points: 0.5 },
  { name: "גבינה צהובה 9% (פרוסה 25 ג')", points: 1 },
  { name: "גבינה צהובה 22% (פרוסה)", points: 2 },
  { name: "גבינה צהובה 28% (פרוסה)", points: 2.5 },
  { name: "גבינה בולגרית 5% (100 ג')", points: 3 },
  { name: 'חלב 3% (כוס 250 מ"ל)', points: 4 },
  { name: 'חלב 1% (כוס 250 מ"ל)', points: 3 },
  { name: "יוגורט טבעי 1.5% - 3% (גביע)", points: 2.5 },
  { name: "מעדן סויה / שוקו דיאט", points: 2 },
  { name: "שמן זית / קנולה / חמאה (כפית)", points: 1 },
  { name: "שמן זית / קנולה (כף)", points: 3 },
  { name: "אבוקדו (רבע)", points: 1 },
  { name: "טחינה מוכנה (כף)", points: 1 },
  { name: "טחינה גולמית (כף)", points: 3 },
  { name: "מיונז (כף שטוחה)", points: 2 },
  { name: "מיונז לייט (2 כפות)", points: 1.5 },
  { name: "זיתים (5 יחידות)", points: 1 },
  { name: "שקדים (8 יחידות)", points: 2 },
  { name: "אגוזי מלך (2 יחידות)", points: 1 },
  { name: "בייגלה שקית קטנה (30 ג')", points: 3 },
  { name: "חטיף צ'יפס שקית (50 ג')", points: 7 },
  { name: "במבה / חטיף בוטנים (שקית 25 ג')", points: 4 },
  { name: "שוקולד חלב/מריר (4 קוביות)", points: 2 },
  { name: "קרמבו", points: 3 },
  { name: "עוגה בחושה פרוסה (30 ג')", points: 3 },
  { name: "גלידה חלבית (כדור חצי כוס)", points: 6 },
  { name: "סורבה פירות (כדור חצי כוס)", points: 3 },
  { name: "ארטיק קרח", points: 1 },
  { name: "המבורגר רגיל בלחמנייה", points: 15 },
  { name: "המבורגר ילדים בלחמנייה", points: 8 },
  { name: "פיצה בצק דק (משולש)", points: 6 },
  { name: "פיצה בצק עבה (משולש)", points: 9 },
  { name: "פלאפל בפיתה (כולל ירקות וטחינה)", points: 15.5 },
  { name: "שווארמה בפיתה (ללא צ'יפס)", points: 13 },
  { name: "סושי ניגירי / מאקי (6 יחידות)", points: 3 },
  { name: "סושי פוטומאקי גדול (6 יחידות)", points: 6 },
  { name: "סלט יווני / סלט קינואה בבית קפה", points: 7 },
  { name: 'קפה הפוך 1% (כוס 250 מ"ל)', points: 2 },
  { name: 'קפה הפוך 3% (כוס 250 מ"ל)', points: 3 },
  { name: "קורנפלקס / דגני בוקר ללא סוכר (30 ג')", points: 3 },
  { name: "פופקורן למיקרו (100 ג')", points: 13 },
  { name: "בורקס יחידה קטנה", points: 5 },
  { name: "בורקס יחידה גדולה", points: 10 },
];

export default function App() {
  // --- פונקציות עזר לתאריכים ---
  const getFormatDate = (dateObj) => {
    // מחזיר מחרוזת YYYY-MM-DD תמיד לפי זמן מקומי כדי למנוע קפיצות זמן
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  const todayString = getFormatDate(new Date());

  // --- State Management ---
  const [view, setView] = useState("dashboard");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayString); // תאריך נבחר

  // נתוני משתמש
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("pointsApp_user");
    return saved
      ? JSON.parse(saved)
      : {
          name: "אורח",
          dailyTarget: 26,
          weeklyTarget: 35,
          startWeight: 80,
          currentWeight: 80,
          goalWeight: 70,
        };
  });

  // יומן אכילה
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem("pointsApp_logs");
    return saved ? JSON.parse(saved) : [];
  });

  // יומן מים (שונה לאובייקט לפי תאריכים)
  const [waterLogs, setWaterLogs] = useState(() => {
    const saved = localStorage.getItem("pointsApp_waterLogs");
    return saved ? JSON.parse(saved) : {};
  });

  // היסטוריית משקל
  const [weightHistory, setWeightHistory] = useState(() => {
    const saved = localStorage.getItem("pointsApp_weights");
    return saved
      ? JSON.parse(saved)
      : [{ date: new Date().toISOString(), weight: 80 }];
  });

  // מאגר מזון אישי (מעודכן: ממזג נתונים ישנים עם רשימה חדשה)
  const [foodDb, setFoodDb] = useState(() => {
    const saved = localStorage.getItem("pointsApp_foodDb");
    if (saved) {
      const savedDb = JSON.parse(saved);
      const combined = [...savedDb];
      // עובר על כל הרשימה החדשה ששמנו בקוד, ומוסיף מה שלא קיים בזיכרון
      initialFoodDatabase.forEach((newItem) => {
        if (!combined.find((existing) => existing.name === newItem.name)) {
          combined.push(newItem);
        }
      });
      return combined;
    }
    return initialFoodDatabase;
  });

  // --- Effects לשמירה מקומית ---
  useEffect(() => {
    localStorage.setItem("pointsApp_user", JSON.stringify(user));
  }, [user]);
  useEffect(() => {
    localStorage.setItem("pointsApp_logs", JSON.stringify(logs));
  }, [logs]);
  useEffect(() => {
    localStorage.setItem("pointsApp_weights", JSON.stringify(weightHistory));
  }, [weightHistory]);
  useEffect(() => {
    localStorage.setItem("pointsApp_foodDb", JSON.stringify(foodDb));
  }, [foodDb]);
  useEffect(() => {
    localStorage.setItem("pointsApp_waterLogs", JSON.stringify(waterLogs));
  }, [waterLogs]);

  // --- חישובים לתאריך הנבחר ---
  const currentLogs = useMemo(
    () => logs.filter((l) => l.date === selectedDate),
    [logs, selectedDate]
  );
  const dailyUsed = useMemo(
    () => currentLogs.reduce((sum, item) => sum + parseFloat(item.points), 0),
    [currentLogs]
  );
  const pointsLeft = user.dailyTarget - dailyUsed;
  const progressPercent = Math.min((dailyUsed / user.dailyTarget) * 100, 100);
  const currentWater = waterLogs[selectedDate] || 0;

  // --- פעולות ---
  const changeDate = (daysToAdd) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + daysToAdd);
    setSelectedDate(getFormatDate(d));
  };

  const addLog = (foodName, points, mealType) => {
    const newLog = {
      id: Date.now(),
      date: selectedDate, // נשמר על התאריך שמוצג כרגע במסך!
      foodName,
      points: parseFloat(points),
      mealType,
    };
    setLogs([newLog, ...logs]);

    if (!foodDb.find((f) => f.name === foodName)) {
      setFoodDb([...foodDb, { name: foodName, points: parseFloat(points) }]);
    }
    setShowAddModal(false);
  };

  const removeLog = (id) => {
    setLogs(logs.filter((l) => l.id !== id));
  };

  const addWater = () => {
    setWaterLogs((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || 0) + 1,
    }));
  };

  const removeWater = () => {
    if (currentWater > 0) {
      setWaterLogs((prev) => ({
        ...prev,
        [selectedDate]: prev[selectedDate] - 1,
      }));
    }
  };

  const updateWeight = (newWeight) => {
    const weight = parseFloat(newWeight);
    setUser({ ...user, currentWeight: weight });
    setWeightHistory([
      ...weightHistory,
      { date: new Date().toISOString(), weight },
    ]);
  };

  const formatDisplayDate = (dateStr) => {
    // פירוק התאריך כדי למנוע בעיות אזור זמן כשיוצרים אובייקט Date חדש
    const [year, month, day] = dateStr.split("-");
    const d = new Date(year, month - 1, day);

    const dateText = d.toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
    });

    if (dateStr === todayString) return `היום, ${dateText}`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === getFormatDate(yesterday)) return `אתמול, ${dateText}`;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === getFormatDate(tomorrow)) return `מחר, ${dateText}`;

    return d.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  // --- רכיבי מסך פנימיים ---

  const Dashboard = () => (
    <div className="space-y-5 pb-20">
      {/* Date Navigator */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <button
          onClick={() => changeDate(1)}
          className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors"
        >
          <ChevronRight size={24} /> {/* ב-RTL ימינה זה קדימה בזמן */}
        </button>

        <div
          className="text-center flex-1 flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setSelectedDate(todayString)}
        >
          <span
            className={`text-lg font-bold ${
              selectedDate === todayString
                ? "text-emerald-600"
                : "text-slate-700"
            }`}
          >
            {formatDisplayDate(selectedDate)}
          </span>
          {selectedDate !== todayString && (
            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full mt-1">
              חזור להיום
            </span>
          )}
        </div>

        <button
          onClick={() => changeDate(-1)}
          className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors"
        >
          <ChevronLeft size={24} /> {/* ב-RTL שמאלה זה אחורה בזמן */}
        </button>
      </div>

      {/* Main Stats Circle */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-emerald-100 text-sm mb-1">נותרו להיום</p>
            <div className="text-5xl font-black tracking-tight">
              {pointsLeft.toFixed(1)}
            </div>
            <p className="text-emerald-100 text-sm mt-1">
              מתוך {user.dailyTarget}
            </p>
          </div>
          <div className="h-24 w-24 relative flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-emerald-700/30"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * progressPercent) / 100}
                className="text-white transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute font-bold text-lg">
              {Math.round(progressPercent)}%
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setShowAddModal(true)} className="h-16 text-lg">
          <Plus size={24} /> הוסף אוכל
        </Button>
        <div className="bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-between px-2 overflow-hidden">
          <button
            onClick={removeWater}
            className="p-3 text-cyan-600 hover:bg-cyan-100 rounded-lg disabled:opacity-30"
            disabled={currentWater === 0}
          >
            -
          </button>
          <div className="flex flex-col items-center flex-1 py-2 text-cyan-700">
            <Droplets size={20} className="mb-0.5" />
            <span className="font-bold text-sm leading-none">
              {currentWater} כוסות
            </span>
          </div>
          <button
            onClick={addWater}
            className="p-3 text-cyan-600 hover:bg-cyan-100 rounded-lg"
          >
            +
          </button>
        </div>
      </div>

      {/* Meals Summary */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 px-1">
          <Calendar size={18} /> סיכום ארוחות
        </h3>
        {["בוקר", "צהריים", "ערב", "ביניים"].map((meal) => {
          const mealLogs = currentLogs.filter((l) => l.mealType === meal);
          const mealPoints = mealLogs.reduce((sum, i) => sum + i.points, 0);

          if (mealLogs.length === 0) return null;

          return (
            <div
              key={meal}
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="flex justify-between items-center mb-2 border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-600">{meal}</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">
                  {mealPoints} נק'
                </span>
              </div>
              <div className="space-y-2">
                {mealLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-center text-sm text-slate-600"
                  >
                    <span>{log.foodName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{log.points}</span>
                      <button
                        onClick={() => removeLog(log.id)}
                        className="text-red-300 hover:text-red-500 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {currentLogs.length === 0 && (
          <div className="text-center py-10 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400">
            טרם הוזנו ארוחות ביום זה
          </div>
        )}
      </div>
    </div>
  );

  const AddFoodModal = () => {
    const [search, setSearch] = useState("");
    const [selectedMeal, setSelectedMeal] = useState("בוקר");
    const [customPoints, setCustomPoints] = useState("");
    const [customName, setCustomName] = useState("");
    const [editItemPoints, setEditItemPoints] = useState({});

    const filteredDb = foodDb
      .filter((f) => f.name.includes(search))
      .slice(0, 5);

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">הוספת ארוחה</h2>
              <p className="text-xs text-emerald-600 font-medium">
                מוסיף ל: {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"
            >
              X
            </button>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {["בוקר", "צהריים", "ערב", "ביניים"].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMeal(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  selectedMeal === m
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <Search
              className="absolute right-3 top-3 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="חפש מאכל..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCustomName(e.target.value);
              }}
            />
          </div>

          {search && filteredDb.length > 0 && (
            <div className="mb-4 space-y-2">
              {filteredDb.map((item, idx) => {
                const pointsVal =
                  editItemPoints[item.name] !== undefined
                    ? editItemPoints[item.name]
                    : item.points;
                return (
                  <div
                    key={idx}
                    className="w-full flex items-center justify-between p-2 pr-3 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-colors"
                  >
                    <span className="flex-1 text-right text-slate-700 font-medium truncate ml-2">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2" dir="ltr">
                      <input
                        type="number"
                        step="0.5"
                        value={pointsVal}
                        onChange={(e) =>
                          setEditItemPoints({
                            ...editItemPoints,
                            [item.name]: e.target.value,
                          })
                        }
                        onClick={(e) => e.target.select()}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-1 py-2 text-center font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() =>
                          addLog(item.name, pointsVal || 0, selectedMeal)
                        }
                        className="bg-emerald-100 text-emerald-700 p-2 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 mt-2">
            <p className="text-xs text-slate-400 mb-2">
              לא מצאת? הוסף ידנית / ערוך שם:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="שם המאכל"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right focus:outline-none focus:border-emerald-500"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <input
                type="number"
                step="0.5"
                placeholder="נקודות"
                className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-center focus:outline-none focus:border-emerald-500"
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
              />
              <Button
                onClick={() =>
                  addLog(
                    customName || "מאכל כללי",
                    customPoints || 0,
                    selectedMeal
                  )
                }
                className="px-4 py-2"
                disabled={!customPoints || !customName}
              >
                הוסף
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CalculatorView = () => {
    const [protein, setProtein] = useState("");
    const [carbs, setCarbs] = useState("");
    const [fat, setFat] = useState("");
    const [fiber, setFiber] = useState("");
    const [result, setResult] = useState(null);
    const [foodName, setFoodName] = useState("");
    const [selectedMeal, setSelectedMeal] = useState("בוקר");

    const calcPoints = () => {
      const p = parseFloat(protein) || 0;
      const c = parseFloat(carbs) || 0;
      const f = parseFloat(fat) || 0;
      const fib = parseFloat(fiber) || 0;

      // החישוב לפי הנוסחה הישנה US (PointsPlus 2010-2015)
      const raw = p / 10.9375 + c / 9.2105 + f / 3.8889 - fib / 12.5;
      const final = Math.max(0, raw);
      setResult(final.toFixed(1));
    };

    const saveToDbOnly = () => {
      if (!foodName) return;
      if (!foodDb.find((f) => f.name === foodName)) {
        setFoodDb([...foodDb, { name: foodName, points: parseFloat(result) }]);
        alert("המאכל נשמר בהצלחה במאגר המזון!");
        setFoodName("");
      } else {
        alert("מאכל בשם זה כבר קיים במאגר.");
      }
    };

    const addAndSave = () => {
      if (!foodName) return;
      // addLog מוסיף ליומן של היום, ואם המאכל לא קיים - גם שומר למאגר!
      addLog(foodName, result, selectedMeal);
      alert("המאכל התווסף ליומן של היום ונשמר במאגר!");
      setFoodName("");
      setView("dashboard"); // מחזיר אותך ליומן לראות שזה התווסף
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">מחשבון נקודות</h2>

        <Card className="space-y-4">
          <p className="text-sm text-slate-500 mb-2">
            חישוב מדויק לפי ערכים תזונתיים (גרם)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-slate-700">חלבון</label>
              <input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">
                פחמימות
              </label>
              <input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">שומן</label>
              <input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700">סיבים</label>
              <input
                type="number"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="0"
              />
            </div>
          </div>
          <Button onClick={calcPoints} className="w-full mt-4">
            חשב נקודות
          </Button>
        </Card>

        {result !== null && (
          <Card className="bg-emerald-50 border-emerald-100 animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-4">
              <p className="text-sm text-emerald-700 font-bold">התוצאה:</p>
              <div className="text-5xl font-black text-emerald-600">
                {result}
              </div>
            </div>

            <div className="border-t border-emerald-200 pt-4 space-y-4">
              <p className="text-sm font-bold text-slate-700">
                מה תרצה לעשות עם המאכל?
              </p>

              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="שם המאכל (למשל: יוגורט מולר)..."
                className="w-full p-3 bg-white rounded-xl border border-emerald-200 focus:outline-none focus:border-emerald-500"
              />

              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {["בוקר", "צהריים", "ערב", "ביניים"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMeal(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      selectedMeal === m
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={addAndSave}
                  disabled={!foodName}
                  className="w-full"
                >
                  הוסף ליומן הארוחות (וישמור למאגר)
                </Button>
                <Button
                  onClick={saveToDbOnly}
                  disabled={!foodName}
                  variant="secondary"
                  className="w-full bg-white hover:bg-slate-50"
                >
                  שמור במאגר בלבד (ללא הוספה ליומן)
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const WeightView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">מעקב משקל</h2>

      <Card>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-slate-500 text-sm">משקל נוכחי</p>
            <div className="text-4xl font-black text-slate-800">
              {user.currentWeight}
            </div>
          </div>
          <div className="text-left">
            <p className="text-slate-500 text-sm">יעד</p>
            <div className="text-xl font-bold text-emerald-600">
              {user.goalWeight}
            </div>
          </div>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-emerald-500"
            style={{
              width: `${Math.min(
                100,
                ((user.startWeight - user.currentWeight) /
                  (user.startWeight - user.goalWeight)) *
                  100
              )}%`,
            }}
          ></div>
        </div>
        <p className="text-xs text-slate-400 text-center">
          ירדת {Math.abs(user.startWeight - user.currentWeight).toFixed(1)} ק"ג
          מתוך {Math.abs(user.startWeight - user.goalWeight)} ק"ג
        </p>
      </Card>

      <div className="bg-white p-4 rounded-2xl border border-slate-100">
        <h3 className="font-bold mb-3">עדכון שקילה</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="משקל עדכני..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4"
            id="newWeightInput"
          />
          <Button
            onClick={() => {
              const val = document.getElementById("newWeightInput").value;
              if (val) {
                updateWeight(val);
                document.getElementById("newWeightInput").value = "";
              }
            }}
          >
            עדכן
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-slate-700">היסטוריה</h3>
        {weightHistory
          .slice()
          .reverse()
          .map((entry, idx) => (
            <div
              key={idx}
              className="flex justify-between p-3 bg-white rounded-xl border border-slate-50"
            >
              <span className="text-slate-500">
                {new Date(entry.date).toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="font-bold text-emerald-600">
                {entry.weight} ק"ג
              </span>
            </div>
          ))}
      </div>
    </div>
  );

  const SettingsView = () => {
    const exportData = () => {
      const data = { user, logs, weightHistory, foodDb, waterLogs };
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-points-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const importData = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (
        !confirm("פעולה זו תחליף את הנתונים הנוכחיים בנתונים מהקובץ. להמשיך?")
      ) {
        event.target.value = ""; // Reset input
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.user) setUser(data.user);
          if (data.logs) setLogs(data.logs);
          if (data.weightHistory) setWeightHistory(data.weightHistory);
          if (data.foodDb) setFoodDb(data.foodDb);
          if (data.waterLogs) setWaterLogs(data.waterLogs);
          alert("הנתונים שוחזרו בהצלחה!");
        } catch (err) {
          alert("שגיאה בקריאת הקובץ. וודא שזהו קובץ גיבוי תקין.");
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">הגדרות</h2>

        <Card className="space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700">שם משתמש</label>
            <input
              value={user.name}
              onChange={(e) => setUser({ ...user, name: e.target.value })}
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700">
              תקציב נקודות יומי
            </label>
            <input
              type="number"
              value={user.dailyTarget}
              onChange={(e) =>
                setUser({ ...user, dailyTarget: parseFloat(e.target.value) })
              }
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700">משקל יעד</label>
            <input
              type="number"
              value={user.goalWeight}
              onChange={(e) =>
                setUser({ ...user, goalWeight: parseFloat(e.target.value) })
              }
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </Card>

        <Card className="bg-emerald-50 border-emerald-100 space-y-3">
          <h3 className="font-bold text-emerald-800 mb-2">
            גיבוי ושחזור נתונים
          </h3>
          <p className="text-xs text-emerald-600 mb-2">
            מומלץ לשמור גיבוי מדי פעם למקרה שתחליף טלפון או שהנתונים יימחקו.
          </p>

          <Button
            onClick={exportData}
            variant="outline"
            className="w-full bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <Download size={18} /> הורד קובץ גיבוי
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={importData}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="secondary" className="w-full">
              <Upload size={18} /> טען גיבוי מקובץ
            </Button>
          </div>
        </Card>

        <Card className="bg-red-50 border-red-100">
          <h3 className="font-bold text-red-600 mb-2">אזור מסוכן</h3>
          <Button
            variant="danger"
            onClick={() => {
              if (
                confirm(
                  "האם אתה בטוח? כל הנתונים יימחקו לצמיתות ולא ניתן יהיה לשחזר אותם."
                )
              ) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full"
          >
            איפוס כל הנתונים
          </Button>
        </Card>
      </div>
    );
  };

  // --- Main Layout ---
  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24"
      dir="rtl"
    >
      <div className="max-w-md mx-auto p-4 pt-8">
        {view === "dashboard" && <Dashboard />}
        {view === "calculator" && <CalculatorView />}
        {view === "weight" && <WeightView />}
        {view === "settings" && <SettingsView />}

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center text-xs font-medium text-slate-400 z-40 max-w-md mx-auto shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setView("dashboard")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              view === "dashboard"
                ? "text-emerald-600"
                : "hover:text-emerald-500"
            }`}
          >
            <PieChart size={24} strokeWidth={view === "dashboard" ? 2.5 : 2} />
            יומן
          </button>

          <button
            onClick={() => setView("calculator")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              view === "calculator"
                ? "text-emerald-600"
                : "hover:text-emerald-500"
            }`}
          >
            <Calculator
              size={24}
              strokeWidth={view === "calculator" ? 2.5 : 2}
            />
            מחשבון
          </button>

          <div className="relative -top-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-200 hover:scale-105 transition-transform"
            >
              <Plus size={28} />
            </button>
          </div>

          <button
            onClick={() => setView("weight")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              view === "weight" ? "text-emerald-600" : "hover:text-emerald-500"
            }`}
          >
            <TrendingDown size={24} strokeWidth={view === "weight" ? 2.5 : 2} />
            משקל
          </button>

          <button
            onClick={() => setView("settings")}
            className={`flex flex-col items-center gap-1 transition-colors ${
              view === "settings"
                ? "text-emerald-600"
                : "hover:text-emerald-500"
            }`}
          >
            <Settings size={24} strokeWidth={view === "settings" ? 2.5 : 2} />
            הגדרות
          </button>
        </div>

        {showAddModal && <AddFoodModal />}
      </div>
    </div>
  );
}
