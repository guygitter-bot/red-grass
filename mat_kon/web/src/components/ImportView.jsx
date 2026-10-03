import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, FileUp, Link2, Loader2, MessageSquareText, MinusCircle, PlayCircle, Square, Upload,
} from 'lucide-react';
import { addRecipe, addTextRecipe } from '../lib/api';
import { findCandidates, parseChat, readChatFile } from '../lib/whatsapp';
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
  const stopRef = useRef(false);

  const load = async (file) => {
    setError('');
    try {
      const { name, text } = await readChatFile(file);
      const messages = parseChat(text);
      if (!messages.length) throw new Error('לא נמצאו הודעות בקובץ. ודאו שזה צ\'אט שיוצא מווטסאפ.');
      const items = findCandidates(messages, {
        existingUrls: recipes.map((r) => r.source?.url),
        existingKeys: recipes.map((r) => r.source?.key),
      });
      setChat({ name, items, messages: messages.length });
      setSelected(Object.fromEntries(items.map((i) => [i.id, i.likely && !i.saved])));
      setStatus({});
    } catch (e) {
      setError(e.message || 'לא הצלחתי לקרוא את הקובץ');
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

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
    const queue = [...chosen];
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const item = queue.shift();
        setOne(item.id, { state: 'working' });
        try {
          const res = item.type === 'link'
            ? await addRecipe(session, item.url)
            : await addTextRecipe(session, { key: item.id, text: item.text, chat: chat.name, author: item.author, date: item.date });
          onRecipe(res.recipe, res.user);
          setOne(item.id, { state: 'done', message: `${res.recipe.title} · ${res.recipe.category}`, recipeId: res.recipe.id });
        } catch (e) {
          if (e.status === 402) {
            stopRef.current = true;
            setOne(item.id, { state: 'waiting' });
            onPaywall(e.data.paymentUrl || '');
          } else if (e.status === 422) {
            setOne(item.id, { state: 'skip', message: 'לא נמצא מתכון' });
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
          <div className="font-bold truncate">{chat?.name ? `ייבוא מ"${chat.name}"` : 'ייבוא מווטסאפ'}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {!chat && (
          <>
            <div className="mt-4 rounded-2xl bg-white shadow-sm p-4 text-stone-700 leading-relaxed text-sm">
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
            <label className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-8 text-orange-800 cursor-pointer hover:bg-orange-100">
              <FileUp size={32} />
              <span className="font-bold">בחירת קובץ הצ'אט</span>
              <span className="text-sm text-orange-700">‎.txt או ‎.zip</span>
              <input
                type="file"
                accept=".txt,.zip,text/plain,application/zip"
                className="hidden"
                onChange={(e) => e.target.files[0] && load(e.target.files[0])}
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </>
        )}

        {chat && (
          <>
            <p className="mt-4 text-sm text-stone-600">
              נסרקו {chat.messages} הודעות. נמצאו {items.filter((i) => i.type === 'link').length} קישורים
              ו-{items.filter((i) => i.type === 'text').length} מתכונים כתובים.
              {items.some((i) => !i.likely && !i.saved) && !showAll && (
                <button onClick={() => setShowAll(true)} className="mr-1 text-orange-700 underline">הצג גם קישורים אחרים</button>
              )}
            </p>

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
                onClick={run}
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

function Row({ item, checked, disabled, status, running, onToggle }) {
  const state = status?.state;
  const icon = item.type === 'text'
    ? <MessageSquareText size={18} />
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
        {(item.context || item.type === 'text') && (
          <p className="text-sm text-stone-500 mt-0.5 line-clamp-2 whitespace-pre-line">
            {item.type === 'link' ? item.context : item.text.split('\n').slice(1).join(' · ')}
          </p>
        )}
        <p className="text-xs text-stone-400 mt-1">
          {item.author} · {item.date}
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
      </div>
    </li>
  );
}
