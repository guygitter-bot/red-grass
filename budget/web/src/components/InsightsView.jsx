// תובנות AI: שאלות מוכנות (סיכום, איפה לחסוך, ביטוחים, הלוואות...) או שאלה חופשית.
// האפליקציה שולחת ל-AI סיכום של התקציב (aiContext) – ההכנסות, ההוצאות, התשלומים והתחזית. התשובות נשמרות.
import { useState } from 'react';
import { Lightbulb, Send, Sparkles, Trash2 } from 'lucide-react';
import { aiContext, monthName, thisMonth } from '../lib/budget';
import { askAi, remove } from '../lib/store';
import Markdown from './Markdown';
import { Button, inputCls } from './ui';

const PRESETS = [
  ['📊', 'תמונת מצב', 'תנו לי תמונת מצב של התקציב: איך אנחנו עומדים, מה המגמה בחודשים האחרונים ובחודשים הקרובים, ומה הכי חשוב לשים לב אליו.'],
  ['💰', 'איפה אפשר לחסוך', 'איפה אפשר לחסוך? תנו רשימה מסודרת של רעיונות חיסכון לפי הנתונים שלנו, עם הערכה כמה כל אחד יחסוך בחודש ובשנה, מהקל והמשתלם ביותר.'],
  ['🛡️', 'ביטוחים', 'עברו על הביטוחים שלנו: האם יש כפילויות (חיים, בריאות, משכנתא, רכב, דירה), מה נראה יקר, ומה כדאי לבדוק מול סוכן או השוואת מחירים.'],
  ['🏦', 'הלוואות ותשלומים', 'עברו על ההלוואות והתשלומים: כמה הם עולים לנו בחודש, מה מסתיים בקרוב וכמה יתפנה, והאם כדאי לאחד או לפרוע משהו מוקדם.'],
  ['📅', 'החודשים הקרובים', 'מה צפוי בחודשים הקרובים? באיזה חודשים יהיה מינוס או לחץ, ומה אפשר לעשות כבר עכשיו כדי להתכונן.'],
  ['💳', 'כרטיסי אשראי', 'נתחו את חיובי כרטיסי האשראי לאורך החודשים: מגמה, חודשים חריגים, ואיך להוריד את ההוצאה השוטפת.'],
  ['🎯', 'יעד חיסכון', 'בנו לנו תוכנית חיסכון ריאלית: כמה אפשר לחסוך כל חודש לפי הנתונים, איפה לשים את הכסף בצורה פשוטה, ומה יעד סביר לשנה.'],
  ['📱', 'מנויים וחשבונות', 'עברו על המנויים והחשבונות הקבועים (סלולר, טלוויזיה, אינטרנט, אפליקציות, ועד בית, ארנונה): מה אפשר להוזיל או לבטל.'],
];

export default function InsightsView({ data }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const month = thisMonth();
  const empty = !data.items.length;

  const ask = async (q) => {
    if (!q.trim() || busy) return;
    setBusy(q);
    setError('');
    try {
      const { id } = await askAi(aiContext(data, month), q.trim(), month);
      setOpenId(id);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="text-accent" /> תובנות AI
      </h1>
      <p className="mb-4 text-sm text-muted">היועץ מקבל סיכום של התקציב (הכנסות, הוצאות, תשלומים, תחזית) ונותן תובנות והמלצות. לא ייעוץ פיננסי מקצועי.</p>

      {empty && <p className="mb-4 rounded-xl bg-soft p-3 text-sm">כדי לקבל תובנות צריך קודם להכניס הכנסות והוצאות (או לייבא מהאקסל בהגדרות).</p>}

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PRESETS.map(([icon, label, q]) => (
          <button
            key={label}
            disabled={!!busy || empty}
            onClick={() => ask(q)}
            className="flex items-center gap-2 rounded-2xl bg-card p-3 text-right text-sm font-medium shadow-sm hover:bg-soft disabled:opacity-50"
          >
            <span className="text-xl">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mb-4 flex gap-2"
      >
        <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="שאלה משלכם, למשל: אפשר להרשות לנו חופשה באוגוסט?" disabled={!!busy || empty} />
        <Button disabled={!question.trim() || !!busy || empty} aria-label="שליחה">
          <Send size={18} />
        </Button>
      </form>

      {busy && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
          <Lightbulb className="animate-pulse text-accent" />
          <span className="text-sm">חושב… (עד דקה)</span>
        </div>
      )}
      {error && <p className="mb-4 rounded-xl bg-soft p-3 text-sm text-minus">{error}</p>}

      <div className="space-y-3">
        {data.insights.map((x, i) => {
          const open = openId ? openId === x.id : i === 0;
          return (
            <article key={x.id} className="rounded-2xl bg-card shadow-sm">
              <button onClick={() => setOpenId(open ? '-' : x.id)} className="flex w-full items-start gap-2 p-4 text-right">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{x.question.length > 90 ? `${x.question.slice(0, 90)}…` : x.question}</div>
                  <div className="text-xs text-muted">
                    {new Date(x.at).toLocaleDateString('he-IL')}
                    {x.month && ` · לפי הנתונים של ${monthName(x.month)}`}
                  </div>
                </div>
              </button>
              {open && (
                <div className="border-t border-line p-4">
                  <Markdown text={x.answer} />
                  <button
                    onClick={() => {
                      if (confirm('למחוק את התשובה הזאת?')) remove(x.id);
                    }}
                    className="mt-3 flex items-center gap-1 text-sm text-muted hover:text-minus"
                  >
                    <Trash2 size={14} /> מחיקה
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
