import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Download, Loader2, LogOut, PlayCircle, ShieldCheck, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { deleteAccount, getAuthConfig, linkGoogle, logoutAll, restoreBackup } from '../lib/api';
import GoogleButton from './GoogleButton';
import { backupFile } from '../lib/recipes';

// הגדרות: גיבוי ושחזור, הזמנות
export default function SettingsView({ session, isOwner, user, recipes, custom, shopping, plan, pantry, onRestored, onSignedOut, onBack, onToast }) {
  const [progress, setProgress] = useState('');
  const [googleId, setGoogleId] = useState('');
  useEffect(() => {
    if (user?.password && !user.google) getAuthConfig().then((c) => setGoogleId(c.googleClientId || '')).catch(() => {});
  }, [user]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

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

  // הגיבוי כולל את התמונות עצמן (ולא רק קישור אליהן), כדי שישוחזרו גם אם המתכון או החשבון נמחקו
  const download = () =>
    run('download', async () => {
      const toDataUrl = async (src) => {
        try {
          const blob = await (await fetch(src)).blob();
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          return src;
        }
      };
      const withImages = [];
      for (const r of recipes) {
        withImages.push(typeof r.image === 'string' && /\/img\/[^/]+\/[0-9a-f-]{36}$/.test(r.image) ? { ...r, image: await toDataUrl(r.image) } : r);
      }
      const blob = new Blob([backupFile({ recipes: withImages, categories: custom, shopping, plan, pantry })], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mat-kon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

  const restore = (file) =>
    run('restore', async () => {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      }
      if (!Array.isArray(data.recipes)) throw new Error('הקובץ הזה לא קובץ גיבוי של mat-kon');
      const res = await restoreBackup(session, data, (done, total) => setProgress(`${done}/${total}`));
      setProgress('');
      onToast(`שוחזרו ${res.restored} מתכונים${res.skipped ? ` (${res.skipped} דולגו)` : ''}, וגם רשימת הקניות, התכנון והמלאי`);
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
        <a href="#/help" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
          <PlayCircle className="text-orange-500" size={22} />
          <span className="flex-1 font-bold">סרטוני הדרכה</span>
          <span className="text-sm text-stone-500">איך משתמשים בכל דבר</span>
        </a>
        {isOwner && (
          <a href="#/invites" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <UserPlus className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">הזמנות</span>
            <span className="text-sm text-stone-500">קישורים לספר מתכונים נפרד</span>
          </a>
        )}
        {isOwner && (
          <a href="#/admin" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <BarChart3 className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">עלויות ותקלות</span>
            <span className="text-sm text-stone-500">שימוש ב-AI לפי ספר</span>
          </a>
        )}

        {user?.role === 'member' ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <Users className="text-orange-500" size={22} />
            <span className="flex-1">
              <span className="block font-bold">ספר משותף</span>
              <span className="text-sm text-stone-500">אתם עובדים על ספר המתכונים של {user.bookName}</span>
            </span>
          </div>
        ) : (isOwner || user) && (
          <a href="#/share" className="flex items-center gap-3 rounded-2xl bg-white shadow-sm p-4">
            <Users className="text-orange-500" size={22} />
            <span className="flex-1 font-bold">שיתוף הספר</span>
            <span className="text-sm text-stone-500">בן/בת זוג ובני משפחה</span>
          </a>
        )}

        <p className="text-sm text-stone-500 px-1">
          קטגוריות משלכם מוסיפים בספר המתכונים, בכפתור "+ קטגוריה" שבשורת הקטגוריות.
        </p>

        <section className="rounded-2xl bg-white shadow-sm p-4">
          <h2 className="font-bold text-lg">גיבוי ושחזור</h2>
          <p className="text-sm text-stone-500 mt-1">
            הגיבוי שומר בקובץ את כל {recipes.length} המתכונים (עם ההערות, הדירוגים והתמונות) ואת הקטגוריות שלכם. שחזור
            מקובץ מוסיף אותם לספר, ומתכון שכבר קיים מתעדכן ולא נכפל. אפשר גם לשחזר לספר אחר (למשל ממכשיר של משתמש מוזמן).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={download} disabled={busy === 'download'} className="rounded-xl bg-orange-500 text-white px-4 py-2.5 font-bold flex items-center gap-1.5 disabled:opacity-50">
              {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} הורדת גיבוי
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy === 'restore'} className="rounded-xl bg-stone-100 px-4 py-2.5 font-medium flex items-center gap-1.5 disabled:opacity-40">
              {busy === 'restore' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {busy === 'restore' && progress ? `משחזר ${progress}` : 'שחזור מקובץ'}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </section>

        {session && (
          <section className="rounded-2xl bg-white shadow-sm p-4">
            <h2 className="font-bold text-lg">החשבון</h2>
            {googleId && (
              <div className="mt-2">
                <p className="text-sm text-stone-600 mb-2">נרשמתם עם סיסמה. אפשר לחבר את חשבון הגוגל שלכם (עם אותו אימייל) ולהיכנס גם בלחיצה.</p>
                <GoogleButton
                  clientId={googleId}
                  text="continue_with"
                  onError={setError}
                  onCredential={(credential) => run('google', async () => {
                    await linkGoogle(session, credential);
                    setGoogleId('');
                    onToast('חשבון הגוגל חובר');
                    onRestored();
                  })}
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => window.confirm('לצאת מהחשבון בכל המכשירים (כולל זה)?') && run('logout-all', async () => {
                  await logoutAll(session);
                  onSignedOut();
                })}
                className="rounded-xl bg-stone-100 px-4 py-2.5 font-medium flex items-center gap-1.5"
              >
                <LogOut size={16} /> יציאה מכל המכשירים
              </button>
              {user && (
                <button
                  onClick={() => {
                    const holder = user.role !== 'member';
                    const warn = holder
                      ? 'למחוק את החשבון לצמיתות? כל המתכונים, רשימת הקניות והתכנון יימחקו, וגם בני המשפחה שבספר יאבדו גישה. אי אפשר לבטל.'
                      : 'למחוק את החשבון שלך? הספר המשותף נשאר אצל בעל הספר.';
                    if (window.prompt(`${warn}\n\nכדי לאשר כתבו: מחיקה`) !== 'מחיקה') return;
                    run('delete', async () => {
                      await deleteAccount(session);
                      onSignedOut();
                    });
                  }}
                  className="rounded-xl bg-red-50 text-red-700 px-4 py-2.5 font-medium flex items-center gap-1.5"
                >
                  <Trash2 size={16} /> מחיקת החשבון
                </button>
              )}
            </div>
          </section>
        )}

        <a href="#/privacy" className="flex items-center gap-2 text-sm text-stone-600 px-1">
          <ShieldCheck size={16} /> פרטיות ותנאי שימוש
        </a>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
