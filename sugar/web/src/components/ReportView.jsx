// מצגת לתקופה: בוחרים שבוע / שבועיים / חודש / 3 חודשים / חצי שנה / שנה או תאריכים, ורואים את השקופיות במסך.
// הורדה כ-PowerPoint (גרפים אמיתיים, אפשר לערוך) או PDF (הדפסה ← "שמירה כ-PDF"), ואפשר להוסיף שקופית של סיכום AI.
import { useMemo, useState } from 'react';
import { Download, Printer, Sparkles } from 'lucide-react';
import { addDays, aiContext } from '../lib/diary';
import { PERIODS, buildReport, daysBetween, longDate, reportText } from '../lib/report';
import { api } from '../lib/api';
import { Button, Field, inputCls } from './ui';
import ReportSlides from './ReportSlides';

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export default function ReportView({ data }) {
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState({ from: addDays(data.today, -29), to: data.today });
  const [ai, setAi] = useState({ key: '', text: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const from = days ? addDays(data.today, -days + 1) : custom.from;
  const to = days ? data.today : custom.to;
  const valid = isDate(from) && isDate(to) && from <= to && daysBetween(from, to) <= 731;
  const periodLabel = days ? PERIODS.find(([d]) => d === days)[1] : `${daysBetween(from, to)} ימים`;
  const report = useMemo(() => (valid ? buildReport(data, from, to) : null), [data, from, to, valid]);
  const key = `${from}|${to}`;
  const aiText = ai.key === key ? ai.text : '';

  const addAi = async () => {
    setBusy('ai');
    setError('');
    try {
      const question = `כתוב/י סיכום לשקופית אחרונה במצגת שמסכמת את התקופה ${longDate(from)} עד ${longDate(to)}, להצגה לצוות הרפואי.
4-6 נקודות קצרות (שורה כל אחת): מה השתנה לעומת התקופה הקודמת, מה עובד, מה חוזר על עצמו (ארוחות, שעות, נמוכים), ומה כדאי לשאול את הצוות.
בלי פתיח ובלי סיום, כותרת אחת (##) ואז נקודות. רק לפי הנתונים.`;
      const { answer } = await api('/ai', { context: `${reportText(report)}\n\n${aiContext(data, to, Math.min(21, report.days))}`, question, history: [] });
      setAi({ key, text: answer });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const pptx = async () => {
    setBusy('pptx');
    setError('');
    try {
      const { downloadDeck } = await import('../lib/pptx');
      await downloadDeck(report, aiText, periodLabel);
    } catch (err) {
      setError(err.message || 'לא הצלחתי ליצור את המצגת');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-4xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="mb-1 text-2xl font-bold">מצגת לתקופה</h1>
        <p className="mb-4 text-sm text-muted">גרפים, השוואה לתקופה הקודמת ומסקנות – להורדה כמצגת או כ-PDF, למשל לפגישה עם הצוות.</p>

        <section className="mb-4 rounded-2xl bg-card p-4 shadow-sm">
          <div className="mb-3 grid grid-cols-3 gap-1.5 lg:grid-cols-7">
            {PERIODS.map(([d, label]) => (
              <button key={d} onClick={() => setDays(d)} className={`rounded-xl border px-2 py-2 text-sm font-medium ${days === d ? 'border-accent bg-soft text-accent-ink' : 'border-line'}`}>
                {label}
              </button>
            ))}
            <button onClick={() => setDays(0)} className={`col-span-3 rounded-xl border px-2 py-2 text-sm font-medium lg:col-span-1 ${!days ? 'border-accent bg-soft text-accent-ink' : 'border-line'}`}>
              תאריכים אחרים
            </button>
          </div>
          {!days && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="מתאריך">
                <input type="date" className={`${inputCls} num`} value={custom.from} max={data.today} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              </Field>
              <Field label="עד תאריך">
                <input type="date" className={`${inputCls} num`} value={custom.to} max={data.today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
              </Field>
            </div>
          )}
          <p className="text-sm text-muted">{valid ? `${longDate(from)} – ${longDate(to)} · מושווה ל-${longDate(report.prev.from)} – ${longDate(report.prev.to)}` : 'הטווח לא תקין (עד שנתיים, ותאריך ההתחלה לפני הסיום)'}</p>
        </section>

        {valid && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={pptx} disabled={!!busy} className="flex items-center gap-2">
              <Download size={18} /> {busy === 'pptx' ? 'מכין…' : 'הורדה כמצגת (PowerPoint)'}
            </Button>
            <Button kind="ghost" onClick={() => window.print()} disabled={!!busy} className="flex items-center gap-2">
              <Printer size={18} /> PDF / הדפסה
            </Button>
            <Button kind="ghost" onClick={addAi} disabled={!!busy || !report.kpis.count} className="flex items-center gap-2">
              <Sparkles size={18} /> {busy === 'ai' ? 'ה-AI כותב סיכום… (עד דקה)' : aiText ? 'לכתוב מחדש את סיכום ה-AI' : 'להוסיף שקופית סיכום AI'}
            </Button>
          </div>
        )}
        {error && <p className="mb-4 rounded-xl bg-low/15 p-3 text-sm text-low">{error}</p>}
        {valid && <p className="mb-3 text-xs text-muted">ל-PDF: "PDF / הדפסה" ← בחירת "שמירה כ-PDF" ביעד ההדפסה. המצגת נפתחת ב-PowerPoint, ב-Google Slides או ב-Keynote.</p>}
      </div>

      {valid && <ReportSlides r={report} ai={aiText} periodLabel={periodLabel} />}
    </div>
  );
}
