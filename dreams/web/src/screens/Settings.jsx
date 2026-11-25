import { useEffect, useState } from 'react';
import Layout, { H2 } from '../components/Layout';
import { useApp } from '../context';
import { exportText, mergeImport, safeData } from '../lib/store';
import { hebrewVoice, speak, chime } from '../lib/night-tools';
import { isDark, toggleTheme } from '../lib/theme';

function Toggle({ label, hint, on, onChange }) {
  return (
    <label className="flex items-start gap-3 min-h-11 py-1">
      <input type="checkbox" className="w-5 h-5 mt-1 accent-[var(--color-accent)]" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function Settings() {
  const { data, update, setToast } = useApp();
  const s = data.settings;
  const [dark, setDark] = useState(isDark());
  const [hasVoice, setHasVoice] = useState(Boolean(hebrewVoice()));
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => update((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));

  // רשימת הקולות נטענת באיחור בחלק מהדפדפנים
  useEffect(() => {
    const onVoices = () => {
      setHasVoice(Boolean(hebrewVoice()));
    };
    try {
      window.speechSynthesis?.addEventListener('voiceschanged', onVoices);
    } catch {
      // אין
    }
    return () => {
      try {
        window.speechSynthesis?.removeEventListener('voiceschanged', onVoices);
      } catch {
        // אין
      }
    };
  }, []);

  const download = () => {
    const blob = new Blob([exportText(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dreams-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const restore = async (file) => {
    setErr('');
    try {
      const merged = mergeImport(data, await file.text());
      update(() => merged);
      setToast(`שוחזרו ${merged.entries.length} רשומות`);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Layout title="הגדרות" back="#/">
      <div className="max-w-xl mx-auto grid gap-6">
        <section className="sheet p-5">
          <H2 className="text-lg">מסכי הלילה</H2>
          <Toggle label="מצב לילה" hint="כהה – נוח לעיניים ליד המיטה" on={dark} onChange={() => setDark(toggleTheme())} />
          <Toggle label="צלצול עדין" hint="בתנומת אדיסון ובמעבר בין שלבי הטקס" on={s.chime} onChange={(v) => set('chime', v)} />
          <Toggle
            label="הקראה בקול"
            hint={hasVoice ? 'משפט הכוונה ותזכורות בקול שקט' : 'לא נמצא קול בעברית במכשיר הזה – יהיה רק צלצול וטקסט על המסך'}
            on={s.voice}
            onChange={(v) => set('voice', v)}
          />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-sm" onClick={() => chime(0.3)}>לשמוע צלצול</button>
            {hasVoice && <button className="btn btn-sm" onClick={() => speak('הלילה אחלום על הים')}>לשמוע קול</button>}
          </div>
          <label className="block mt-4">
            <span className="block font-semibold mb-1">סבבים בתנומת אדיסון</span>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button key={n} className="chip w-11 justify-center" aria-pressed={s.napCycles === n} onClick={() => set('napCycles', n)}>
                  {n}
                </button>
              ))}
            </div>
          </label>
        </section>

        <section className="sheet p-5">
          <H2 className="text-lg">הנתונים שלך</H2>
          <p className="text-muted mt-0">החלומות נשמרים רק בטלפון הזה, בלי שרת ובלי חשבון. מחיקת נתוני הדפדפן תמחק גם אותם – לכן כדאי לשמור גיבוי מדי פעם.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={download}>לשמור גיבוי לקובץ</button>
            <label className="btn">
              לשחזר מגיבוי
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files[0] && restore(e.target.files[0])} />
            </label>
          </div>
          {err && <p className="text-dawn font-semibold mb-0" role="alert">{err}</p>}
          <p className="text-sm text-muted">שחזור מוסיף את מה שבקובץ ולא מוחק חלומות שכבר יש.</p>
          <div className="border-t border-line pt-4 mt-4">
            {!confirm ? (
              <button className="btn btn-sm" onClick={() => setConfirm(true)}>למחוק את כל היומן</button>
            ) : (
              <div className="grid gap-2">
                <p className="m-0 font-semibold">למחוק {data.entries.length} רשומות וכל הכוונות? אי אפשר לבטל.</p>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm border-dawn text-dawn"
                    onClick={() => {
                      update((d) => safeData({ settings: d.settings }));
                      setConfirm(false);
                      setToast('היומן נמחק');
                    }}
                  >
                    כן, למחוק הכול
                  </button>
                  <button className="btn btn-sm" onClick={() => setConfirm(false)}>ביטול</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <p className="text-sm text-muted text-center">זימון חלומות · לא ייעוץ רפואי</p>
      </div>
    </Layout>
  );
}
