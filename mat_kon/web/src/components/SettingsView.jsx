import { useRef, useState } from 'react';
import { ArrowRight, Download, Loader2, Plus, Trash2, Upload, UserPlus } from 'lucide-react';
import { CATEGORIES } from '../lib/categories';
import { addCategory, removeCategory, restoreBackup } from '../lib/api';
import { backupFile, countByCategory, emojiOf } from '../lib/recipes';

// הגדרות: קטגוריות משלי, גיבוי ושחזור
export default function SettingsView({ session, isOwner, recipes, custom, shopping, plan, onCustomChange, onRestored, onBack, onToast }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const counts = countByCategory(recipes);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run('add', async () => {
      onCustomChange(await addCategory(session, name.trim()));
      setName('');
    });
  };

  const download = () => {
    const blob = new Blob([backupFile({ recipes, categories: custom, shopping, plan })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mat-kon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const restore = (file) =>
    run('restore', async () => {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      }
      if (!Array.isArray(data.recipes)) throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      const res = await restoreBackup(session, { recipes: data.recipes, categories: data.categories || [] });
      onToast(`שוחזרו ${res.restored} מתכונים${res.skipped ? ` (${res.skipped} דולגו)` : ''}`);
      onRestored();
    });

  return (
    <div className="min-h-screen pb-16">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold">הגדרות</div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 space-y-6 mt-4">
        {isOwner && (
          <a href="#/invites" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <UserPlus className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">הזמנות</span>
            <span className="text-sm text-stone-500">קישורים לספר מתכונים נפרד</span>
          </a>
        )}

        <section className="rounded-2xl bg-white shadow-sm p-4">
          <h2 className="font-bold text-lg">הקטגוריות שלי</h2>
          <p className="text-sm text-stone-500 mt-1">
            קטגוריות שתוסיפו (למשל "מתכוני סבתא", "לשבת", "לילדים") יופיעו בספר, והסוכן ישבץ בהן מתכונים חדשים כשהן מתאימות.
          </p>
          <form onSubmit={add} className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="שם הקטגוריה"
              className="flex-1 min-w-0 rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-orange-400"
            />
            <button disabled={busy === 'add'} className="rounded-xl bg-orange-500 text-white px-3 font-bold flex items-center gap-1 shrink-0 disabled:opacity-40">
              {busy === 'add' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} הוספה
            </button>
          </form>
          <ul className="mt-3 divide-y divide-stone-100">
            {custom.map((c) => (
              <li key={c} className="flex items-center gap-2 py-2">
                <span>{emojiOf(c)}</span>
                <span className="flex-1">{c}</span>
                <span className="text-xs text-stone-400">{counts[c] || 0} מתכונים</span>
                <button
                  onClick={() => window.confirm(`למחוק את הקטגוריה "${c}"? המתכונים שבה יעברו ל"אחר".`) &&
                    run(`rm:${c}`, async () => onCustomChange((await removeCategory(session, c)).custom, c))}
                  className="p-1.5 text-stone-400 hover:text-red-600"
                  aria-label={`מחיקת ${c}`}
                >
                  {busy === `rm:${c}` ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-400">קבועות: {CATEGORIES.join(' · ')}</p>
        </section>

        <section className="rounded-2xl bg-white shadow-sm p-4">
          <h2 className="font-bold text-lg">גיבוי ושחזור</h2>
          <p className="text-sm text-stone-500 mt-1">
            הגיבוי שומר בקובץ את כל {recipes.length} המתכונים (עם ההערות, הדירוגים והתמונות) ואת הקטגוריות שלכם. שחזור
            מקובץ מוסיף אותם לספר, ומתכון שכבר קיים מתעדכן ולא נכפל. אפשר גם לשחזר לספר אחר (למשל ממכשיר של משתמש מוזמן).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={download} className="rounded-xl bg-orange-500 text-white px-4 py-2.5 font-bold flex items-center gap-1.5">
              <Download size={16} /> הורדת גיבוי
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy === 'restore'} className="rounded-xl bg-stone-100 px-4 py-2.5 font-medium flex items-center gap-1.5 disabled:opacity-40">
              {busy === 'restore' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} שחזור מקובץ
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files[0] && restore(e.target.files[0])} />
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
