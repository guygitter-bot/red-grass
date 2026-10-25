import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, FileText, FileUp, Image as ImageIcon, Link2, Loader2, MessageSquareText, MinusCircle, PlayCircle, Square, Upload,
} from 'lucide-react';
import { addPhotoRecipe, addRecipeAndWait, addTextRecipe } from '../lib/api';
import { findCandidates, parseChat, readChatFile } from '../lib/whatsapp';
import { isKeepTakeout, readKeepTakeout } from '../lib/keep';
import { fileCandidates, isImageFile, readRecipeFile, splitDocument } from '../lib/files';
import { readImportFile } from '../lib/importers';
import { dataUrlToPart, photoForReading, thumbnail } from '../lib/image';
import PasteBox from './PasteBox';
import { freeLeft } from '../lib/recipes';

const CONCURRENCY = 2;

// קובץ ששותף לאפליקציה מווטסאפ (share target) נשמר ב-service worker עד שהמסך הזה קורא אותו
async function takeSharedFile() {
  try {
    const cache = await caches.open('matkon-share');
    const res = await cache.match('shared-chat');
    if (!res) return null;
    await cache.delete('shared-chat');
    const name = decodeURIComponent(res.headers.get('x-file-name') || 'chat.txt');
    return new File([await res.blob()], name);
  } catch {
    return null;
  }
}

export default function ImportView({ session, user, recipes, onBack, onRecipe, onPaywall }) {
  const [chat, setChat] = useState(null); // { name, items }
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState({}); // id -> { state, message, recipeId }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [reading, setReading] = useState(''); // קריאת קובץ גדול (PDF) – מה קורה עכשיו
  const stopRef = useRef(false);

  const show = (next) => {
    setChat(next);
    setSelected(Object.fromEntries(next.items.map((i) => [i.id, i.likely && !i.saved])));
    setStatus({});
  };

  // תמונות (גם HEIC מאייפון): עד 4 – מתכון אחד (כמו צילום מתכון); יותר – כל תמונה בנפרד
  const loadImages = async (files) => {
    const list = files.slice(0, 20);
    const groups = list.length <= 4 ? [list] : list.map((f) => [f]);
    const pages = [];
    for (const [i, group] of groups.entries()) {
      setReading(`מכין תמונה ${i + 1} מתוך ${groups.length}…`);
      const images = [];
      for (const f of group) images.push(await photoForReading(f));
      pages.push({ images, thumb: await thumbnail(group[0]).catch(() => null), label: group.length > 1 ? `${group.length} תמונות` : group[0].name });
    }
    const name = list.length === 1 ? list[0].name : `${list.length} תמונות`;
    show({ name, file: true, items: fileCandidates({ name, pages }) });
  };

  // כל קובץ אחר: צ'אט מווטסאפ, Keep, גיבוי מאפליקציה, או מסמך (Word, PDF, טקסט...)
  const loadDocument = async (file) => {
    const read = await readRecipeFile(file, setReading);
    if (read.pages) {
      show({ name: read.name, file: true, truncated: read.truncated, items: fileCandidates(read) });
      return;
    }
    const parts = splitDocument(read.text);
    if (!parts.length || read.text.replace(/\s/g, '').length < 20) throw new Error('לא מצאתי טקסט בקובץ. אם זה צילום או סריקה – בחרו את התמונה עצמה או PDF.');
    show({ name: read.name, file: true, items: fileCandidates({ name: read.name, parts }, { existingKeys: recipes.map((r) => r.source?.key) }) });
  };

  const load = async (picked) => {
    setError('');
    const files = [...(picked instanceof File ? [picked] : picked)];
    if (!files.length) return;
    try {
      if (files.every(isImageFile)) {
        await loadImages(files);
        return;
      }
      const file = files.find((f) => !isImageFile(f));
      // קובץ Google Takeout עם פתקים מ-Google Keep – כל פתק כמו הודעה
      const bytes = new Uint8Array(await file.arrayBuffer());
      const keep = isKeepTakeout(bytes);
      // קובץ גיבוי מאפליקציית מתכונים אחרת – נכנס בהגדרות, בלי AI ובלי מכסה
      if (!keep && /\.(zip|paprikarecipes?|rtk|mcb|xml)$/i.test(file.name)) {
        let app = null;
        try {
          app = readImportFile(bytes).app;
        } catch {
          // לא גיבוי – ממשיכים
        }
        if (app) throw Object.assign(new Error(`זה קובץ גיבוי מ-${app}. מכניסים אותו בהגדרות ← "ייבוא מאפליקציה אחרת" (בלי לגעת במכסה).`), { settings: true });
      }
      const chatFile = keep || /\.(txt|zip)$/i.test(file.name) ? (keep ? { name: 'Google Keep', text: '' } : await readChatFile(file).catch(() => null)) : null;
      const messages = keep ? readKeepTakeout(bytes) : chatFile ? parseChat(chatFile.text) : [];
      // לא צ'אט (פחות משתי הודעות) – קוראים כמסמך
      if (!keep && messages.length < 2) {
        await loadDocument(file);
        return;
      }
      const items = findCandidates(messages, {
        existingUrls: recipes.map((r) => r.source?.url),
        existingKeys: recipes.map((r) => r.source?.key),
        allText: keep,
      });
      show({ name: chatFile.name, items, messages: messages.length });
    } catch (e) {
      setError(e);
    } finally {
      setReading('');
    }
  };

  useEffect(() => {
    if (!/shared=1/.test(window.location.hash)) return;
    takeSharedFile().then((file) => file && load(file));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = chat?.items || [];
  const visible = showAll ? items : items.filter((i) => i.likely || i.saved || selected[i.id]);
  const chosen = items.filter((i) => selected[i.id] && !['done', 'skip'].includes(status[i.id]?.state));
  const left = freeLeft(user);
  const counts = useMemo(() => {
    const c = { done: 0, skip: 0, error: 0 };
    for (const s of Object.values(status)) if (s.state in c) c[s.state] += 1;
    return c;
  }, [status]);

  const setOne = (id, value) => setStatus((s) => ({ ...s, [id]: value }));

  // טקסט שהמשתמש העתיק מפוסט שלא נקרא – המתכון נבנה ממנו והקישור נשאר
  const fromPasted = async (item, text) => {
    const res = await addTextRecipe(session, { url: item.url, text, chat: chat.name, author: item.author, date: item.date });
    onRecipe(res.recipe, res.user);
    setOne(item.id, { state: 'done', message: `${res.recipe.title} · ${res.recipe.category}`, recipeId: res.recipe.id });
  };

  const run = async (only) => {
    stopRef.current = false;
    setRunning(true);
    const queue = [...(only || chosen)];
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const item = queue.shift();
        setOne(item.id, { state: 'working' });
        try {
          const res = item.type === 'link'
            ? await addRecipeAndWait(session, item.url, item.context)
            : item.type === 'photo'
              ? await addPhotoRecipe(session, { images: item.images.map(dataUrlToPart), thumb: item.thumb })
              : await addTextRecipe(session, chat.file
                ? { key: item.id, text: item.text, file: true, chat: chat.name }
                : { key: item.id, text: item.text, chat: chat.name, author: item.author, date: item.date });
          // הודעה עם כמה מתכונים שונים – כולם נוספים
          for (const r of res.more || []) onRecipe(r, res.user);
          onRecipe(res.recipe, res.user);
          setOne(item.id, { state: 'done', message: [res.recipe, ...(res.more || [])].map((r) => `${r.title} · ${r.category}`).join(' | '), recipeId: res.recipe.id });
        } catch (e) {
          if (e.status === 402) {
            stopRef.current = true;
            setOne(item.id, { state: 'waiting' });
            onPaywall(e.data.paymentUrl || '');
          } else if (e.status === 422) {
            setOne(item.id, { state: 'skip', message: e.message || 'לא נמצא מתכון' });
          } else {
            setOne(item.id, { state: 'error', message: e.message });
          }
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-10 bg-[#fffbf5]/90 backdrop-blur border-b border-stone-100 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-2 h-14 flex items-center gap-1">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-100" aria-label="חזרה">
            <ArrowRight size={22} />
          </button>
          <div className="font-bold truncate">{chat?.name ? `ייבוא מ"${chat.name}"` : 'ייבוא מתכונים'}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {!chat && (
          <>
            <label className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-6 text-orange-800 text-center ${reading ? 'pointer-events-none opacity-70' : 'cursor-pointer hover:bg-orange-100'}`}>
              {reading ? <Loader2 size={32} className="animate-spin" /> : <FileUp size={32} />}
              <span className="font-bold">{reading || 'בחירת קובץ'}</span>
              {!reading && (
                <span className="text-sm text-orange-700 leading-relaxed">
                  Word, PDF, טקסט, תמונות, דף אינטרנט שנשמר, צ'אט מווטסאפ או קובץ Keep –
                  מהטלפון, מהמחשב, מ-Google Drive או מ-iCloud
                </span>
              )}
              {/* בלי הגבלת סוג: כך באנדרואיד ובאייפון נפתחים גם "קבצים", דרייב ו-iCloud */}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={Boolean(reading)}
                onChange={(e) => { if (e.target.files.length) load(e.target.files); e.target.value = ''; }}
              />
            </label>
            {error && (
              <p className="mt-3 text-sm text-red-600">
                {error.message || 'לא הצלחתי לקרוא את הקובץ'}
                {error.settings && <a href="#/settings" className="mr-1 text-orange-700 underline">להגדרות</a>}
              </p>
            )}
            <div className="mt-4 rounded-2xl bg-white shadow-sm p-4 text-stone-700 leading-relaxed text-sm">
              <h2 className="font-bold text-base text-stone-900 mb-2 flex items-center gap-1.5"><FileText size={18} className="text-orange-500" /> מתכונים בקובץ</h2>
              <p>
                מסמך עם מתכון אחד או חוברת שלמה: הקובץ נקרא בטלפון, ואם יש בו כמה מתכונים הוא מחולק לחלקים – בוחרים
                מה להכניס. PDF סרוק או צילום נקראים כמו צילום מתכון.
              </p>
              <p className="mt-1 text-stone-500">
                באייפון: "עיון" ← iCloud Drive / Google Drive. קובץ Pages – קודם ייצוא ל-PDF או Word.
              </p>
            </div>
            <div className="mt-3 rounded-2xl bg-white shadow-sm p-4 text-stone-700 leading-relaxed text-sm">
              <h2 className="font-bold text-base text-stone-900 mb-2">איך מייצאים צ'אט או קבוצה מווטסאפ</h2>
              <ol className="list-decimal pr-5 space-y-1">
                <li>פותחים בווטסאפ את הצ'אט או את קבוצת המתכונים.</li>
                <li>
                  <b>אנדרואיד:</b> ⋮ ← עוד ← ייצוא צ'אט ← <b>ללא מדיה</b> ← בוחרים <b>mat-kon</b> (אם האפליקציה
                  מותקנת במסך הבית), או שומרים את הקובץ ובוחרים אותו כאן.
                </li>
                <li>
                  <b>אייפון:</b> לוחצים על שם הקבוצה ← ייצוא צ'אט ← <b>ללא מדיה</b> ← שמירה בקבצים, ובוחרים
                  את הקובץ כאן.
                </li>
              </ol>
              <p className="mt-2 text-stone-500">הסריקה נעשית בטלפון. רק המתכונים שתבחרו נשלחים לסידור.</p>
            </div>
            <div className="mt-3 rounded-2xl bg-white shadow-sm p-4 text-stone-700 leading-relaxed text-sm">
              <h2 className="font-bold text-base text-stone-900 mb-2">מתכונים בפתקים של Google Keep?</h2>
              <ol className="list-decimal pr-5 space-y-1">
                <li>נכנסים ל-<a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-orange-700 underline">takeout.google.com</a> ← <b>ביטול הבחירה</b> בכל השירותים ← מסמנים רק את <b>Keep</b>.</li>
                <li>יוצרים את הייצוא. גוגל שולחת קישור להורדה במייל (בדרך כלל תוך כמה דקות).</li>
                <li>מורידים את קובץ ה-ZIP ובוחרים אותו כאן. בוחרים אילו פתקים הם מתכונים – רק הם נשלחים לסידור.</li>
              </ol>
            </div>
          </>
        )}

        {chat && (
          <>
            {chat.file ? (
              <p className="mt-4 text-sm text-stone-600">
                {items.length > 1
                  ? `הקובץ חולק ל-${items.length} חלקים. סמנו את החלקים עם מתכונים – בכל חלק יכולים להיות כמה מתכונים, וכל מתכון נספר בנפרד.`
                  : 'הקובץ מוכן. כל מתכון שיימצא בו נספר בנפרד.'}
                {chat.truncated && ' נקראו רק 12 העמודים הראשונים – לשאר העמודים פצלו את הקובץ.'}
              </p>
            ) : (
            <p className="mt-4 text-sm text-stone-600">
              נסרקו {chat.messages} {chat.name === 'Google Keep' ? 'פתקים' : 'הודעות'}. נמצאו {items.filter((i) => i.type === 'link').length} קישורים
              ו-{items.filter((i) => i.type === 'text').length} מתכונים כתובים.
              {items.some((i) => !i.likely && !i.saved) && !showAll && (
                <button onClick={() => setShowAll(true)} className="mr-1 text-orange-700 underline">הצג גם קישורים אחרים</button>
              )}
            </p>
            )}

            {items.length === 0 && <p className="mt-10 text-center text-stone-500">לא נמצאו קישורים או מתכונים בצ'אט הזה</p>}

            {visible.length > 0 && !running && (
              <div className="mt-3 flex gap-3 text-sm">
                <button onClick={() => setSelected(Object.fromEntries(visible.map((i) => [i.id, !i.saved])))} className="text-orange-700 font-medium">בחירת הכל</button>
                <button onClick={() => setSelected({})} className="text-stone-500">ניקוי</button>
              </div>
            )}

            <ul className="mt-3 space-y-2">
              {visible.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  checked={Boolean(selected[item.id])}
                  disabled={running || ['done', 'working'].includes(status[item.id]?.state)}
                  status={status[item.id]}
                  running={running}
                  onPaste={(text) => fromPasted(item, text).catch((e) => {
                    if (e.status === 402) onPaywall(e.data.paymentUrl || '');
                    throw e;
                  })}
                  onToggle={() => setSelected((s) => ({ ...s, [item.id]: !s[item.id] }))}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {chat && items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-stone-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            {!running && counts.skip + counts.error > 0 && (
              <button
                onClick={() => run(items.filter((i) => ['skip', 'error'].includes(status[i.id]?.state)))}
                className="w-full mb-2 rounded-2xl bg-orange-50 text-orange-800 font-medium py-2.5 text-sm"
              >
                ניסיון נוסף ל-{counts.skip + counts.error} שלא נמצאו
              </button>
            )}
            {(counts.done > 0 || counts.skip > 0 || counts.error > 0) && (
              <p className="text-xs text-stone-500 mb-2 text-center">
                נוספו {counts.done}
                {counts.skip ? ` · ${counts.skip} בלי מתכון` : ''}
                {counts.error ? ` · ${counts.error} נכשלו` : ''}
                {running ? ' · השאירו את האפליקציה פתוחה עד הסוף' : ''}
              </p>
            )}
            {left !== null && chosen.length > left && !running && (
              <p className="text-xs text-amber-700 mb-2 text-center">נשארו לך {left} מתכונים חינמיים, וייבוא נוסף יעצור כשייגמרו.</p>
            )}
            {running ? (
              <button onClick={() => { stopRef.current = true; }} className="w-full rounded-2xl bg-stone-900 text-white font-bold py-3 flex items-center justify-center gap-2">
                <Square size={16} /> עצירה (הסידורים שכבר התחילו יסתיימו)
              </button>
            ) : (
              <button
                disabled={!chosen.length}
                onClick={() => run()}
                className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Upload size={18} /> {chosen.length ? `ייבוא ${chosen.length} לספר המתכונים` : 'בחרו מה לייבא'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ item, checked, disabled, status, running, onToggle, onPaste }) {
  const state = status?.state;
  const icon = item.type === 'photo' ? <ImageIcon size={18} /> : item.type === 'text'
    ? item.id.startsWith('file:') ? <FileText size={18} /> : <MessageSquareText size={18} />
    : /youtu|tiktok|instagram|facebook|fb\.watch|vimeo/.test(item.host) ? <PlayCircle size={18} /> : <Link2 size={18} />;
  return (
    <li className={`bg-white rounded-2xl shadow-sm p-3 flex gap-3 ${item.saved && !state ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`mt-0.5 w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center ${checked ? 'bg-orange-500 border-orange-500 text-white' : 'border-stone-300'}`}
        aria-label="בחירה"
      >
        {checked && <Check size={15} strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-stone-800">
          <span className="text-orange-500 shrink-0">{icon}</span>
          <span className="font-medium truncate" dir={item.type === 'link' ? 'ltr' : 'auto'}>
            {item.type === 'link' ? item.host : item.title}
          </span>
        </div>
        {item.type === 'photo' && item.thumb && <img src={item.thumb} alt="" className="mt-1.5 h-20 rounded-lg border border-stone-200" />}
        {(item.context || item.type === 'text') && (
          <p className="text-sm text-stone-500 mt-0.5 line-clamp-2 whitespace-pre-line">
            {item.type === 'link' ? item.context : item.text.split('\n').slice(1).join(' · ')}
          </p>
        )}
        <p className="text-xs text-stone-400 mt-1">
          {[item.author, item.date].filter(Boolean).join(' · ')}
          {item.shares > 1 ? ` · שותף ${item.shares} פעמים` : ''}
          {item.saved ? ' · כבר בספר' : ''}
        </p>
        {state && (
          <p className={`text-sm mt-1.5 flex items-center gap-1.5 ${state === 'error' ? 'text-red-600' : state === 'done' ? 'text-emerald-700' : 'text-stone-500'}`}>
            {state === 'working' && <><Loader2 size={15} className="animate-spin" /> מסדר מתכון…</>}
            {state === 'done' && (
              <><Check size={15} /> {running ? <span className="truncate">{status.message}</span> : <a href={`#/r/${status.recipeId}`} className="underline truncate">{status.message}</a>}</>
            )}
            {state === 'skip' && <><MinusCircle size={15} /> {status.message}</>}
            {state === 'error' && <><AlertCircle size={15} /> {status.message}</>}
          </p>
        )}
        {['skip', 'error'].includes(state) && item.type === 'link' && !running && <PasteBox url={item.url} onSubmit={onPaste} />}
      </div>
    </li>
  );
}
