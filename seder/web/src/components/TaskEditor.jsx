import { useState } from 'react';
import { CalendarPlus, Download, ExternalLink, Phone, Plus, Share2, Trash2, User, X } from 'lucide-react';
import { useStore } from '../App';
import { PRIORITIES, REMIND_OPTIONS, TYPES, cleanContact, knownContacts, makeTask, newId, removeTask, saveTree, subtasksOf, telUrl } from '../lib/store';
import { addDays, shortDate, todayKey } from '../lib/dates';
import { extractLinks, linkKind } from '../lib/parse';
import { downloadIcs, googleCalendarUrl } from '../lib/calendar';
import { shareText, taskText } from '../lib/share';
import { colorOf } from '../lib/colors';
import { Chip, Sheet, TimeInput } from './ui';
import Attachments from './Attachments';

// בלי שעה: התזכורת יוצאת ב-9 בבוקר של אותו יום
const MORNING_OPTIONS = [REMIND_OPTIONS[0], { value: 0, label: 'בבוקר של אותו יום (9:00)' }];
// תזכורת בשעה מדויקת שבוחרים (ביום של המשימה)
const CUSTOM = { value: 'custom', label: 'בשעה שאבחר...' };
const label = 'block text-xs font-bold text-stone-500 mb-1.5 mt-4';
const input = 'w-full rounded-xl border border-stone-200 bg-card px-3 py-2 outline-none focus:border-violet-500';

export default function TaskEditor({ initial, onClose }) {
  const { state, act } = useStore();
  const existing = initial.id && state.tasks.some((t) => t.id === initial.id);
  const [task, setTask] = useState(() => (existing ? { ...state.tasks.find((t) => t.id === initial.id) } : makeTask(initial)));
  const [subs, setSubs] = useState(() => (existing ? subtasksOf(state.tasks, initial.id).map((s) => ({ ...s })) : []));
  const [newSub, setNewSub] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const set = (patch) => setTask((t) => ({ ...t, ...patch }));
  const setSub = (id, patch) => setSubs((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const today = todayKey();

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubs((list) => [...list, { id: newId(), title: newSub.trim(), done: false, due: null, priority: 2, createdAt: Date.now() }]);
    setNewSub('');
  };

  // אנשים / גורמים לבירור: שם (חובה) וטלפון (רשות). שם שכבר הופיע במשימה אחרת – הטלפון נשלף לבד
  const known = knownContacts(state.tasks);
  const phoneFor = (name) => known.find((k) => k.name.toLowerCase() === name.trim().toLowerCase())?.phone || '';
  const contacts = task.contacts || [];
  const setContact = (i, patch) => set({ contacts: contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const pendingContact = () => (newContact.name.trim() ? [cleanContact({ ...newContact, phone: newContact.phone || phoneFor(newContact.name) })] : []);
  const addContact = () => {
    if (!newContact.name.trim()) return;
    set({ contacts: [...contacts, ...pendingContact()] });
    setNewContact({ name: '', phone: '' });
  };

  const addLink = () => {
    const urls = extractLinks(newLink.includes('://') ? newLink : `https://${newLink.trim()}`);
    if (!urls.length) return;
    set({ links: [...(task.links || []), ...urls.map((url) => ({ url, kind: linkKind(url) }))] });
    setNewLink('');
  };

  const commit = () => {
    if (!task.title.trim()) return;
    const pending = newSub.trim() ? [...subs, { id: newId(), title: newSub.trim(), done: false, priority: 2 }] : subs;
    const people = [...contacts, ...pendingContact()].map(cleanContact).filter((c) => c.name || c.phone);
    act(saveTree, { ...task, title: task.title.trim(), contacts: people }, pending.filter((s) => s.title.trim()));
    onClose();
  };

  const remove = () => {
    if (!window.confirm(subs.length ? 'למחוק את המשימה וכל תתי המשימות?' : 'למחוק את המשימה?')) return;
    act(removeTask, task.id);
    onClose();
  };

  const footer = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={commit} disabled={!task.title.trim()} className="flex-1 rounded-2xl bg-violet-600 text-white font-bold py-3 disabled:opacity-40">שמירה</button>
        {existing && <button aria-label="מחיקה" onClick={remove} className="rounded-2xl border border-stone-200 px-4 text-rose-600"><Trash2 size={20} /></button>}
      </div>
      <div className="flex gap-2 text-sm">
        <button onClick={() => shareText(taskText(task, subs))} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 py-2"><Share2 size={16} />שיתוף בווטסאפ</button>
        {task.due && (
          <>
            <a href={googleCalendarUrl(task)} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 text-sky-700 py-2"><CalendarPlus size={16} />ליומן גוגל</a>
            <button aria-label="קובץ ליומן" title="קובץ ליומן (אייפון / אאוטלוק)" onClick={() => downloadIcs([task], 'event')} className="rounded-xl bg-sky-50 text-sky-700 px-3"><Download size={16} /></button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Sheet title={existing ? 'עריכת משימה' : 'משימה חדשה'} onClose={onClose} footer={footer}>
      <textarea
        autoFocus={!existing}
        value={task.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="מה צריך לעשות?"
        rows={2}
        className="w-full text-lg font-medium resize-none outline-none border-b border-stone-200 focus:border-violet-500 pb-2"
      />

      <span className={label}>סוג</span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-visible">
        {Object.entries(TYPES).map(([id, t]) => <Chip key={id} active={task.type === id} onClick={() => set({ type: id })}>{t.emoji} {t.label}</Chip>)}
      </div>

      <span className={label}>תחום</span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-visible">
        <Chip active={!task.categoryId} onClick={() => set({ categoryId: null })}>ללא</Chip>
        {state.categories.map((c) => (
          <Chip key={c.id} active={task.categoryId === c.id} onClick={() => set({ categoryId: c.id })} className={task.categoryId === c.id ? '' : colorOf(c.color).soft + ' border-transparent'}>{c.emoji} {c.name}</Chip>
        ))}
      </div>

      <span className={label}>מתי</span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-visible mb-2">
        <Chip active={task.due === today} onClick={() => set({ due: today })}>היום</Chip>
        <Chip active={task.due === addDays(today, 1)} onClick={() => set({ due: addDays(today, 1) })}>מחר</Chip>
        <Chip active={task.due === addDays(today, 7)} onClick={() => set({ due: addDays(today, 7) })}>בעוד שבוע</Chip>
        <Chip active={!task.due} onClick={() => set({ due: null, time: null })}>בלי תאריך</Chip>
      </div>
      <div className="flex gap-2">
        <input type="date" aria-label="תאריך" value={task.due || ''} onChange={(e) => set({ due: e.target.value || null })} className={input} />
        <TimeInput aria-label="שעה" value={task.time || ''} onChange={(t) => set({ time: t || null, due: task.due || today, remind: !t && task.remind != null ? 0 : task.remind })} className={`${input} max-w-36`} />
      </div>

      <span className={label}>רמת חשיבות</span>
      <div className="grid grid-cols-3 gap-2">
        {[3, 2, 1].map((p) => (
          <button key={p} type="button" onClick={() => set({ priority: p })} className={`rounded-xl border py-2 text-sm flex items-center justify-center gap-1.5 ${task.priority === p ? PRIORITIES[p].ring + ' font-bold' : 'border-stone-200'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${PRIORITIES[p].dot}`} />{PRIORITIES[p].short}
          </button>
        ))}
      </div>

      {task.due && (
        <>
          <span className={label}>תזכורת</span>
          <div className="flex gap-2">
            <select
              aria-label="מתי להזכיר"
              value={task.remindTime && task.remind != null ? 'custom' : task.remind ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom') set({ remind: 0, remindTime: task.remindTime || task.time || '08:00' });
                else set({ remind: v === '' ? null : Number(v), remindTime: null });
              }}
              className={input}
            >
              {[...(task.time ? REMIND_OPTIONS : MORNING_OPTIONS), CUSTOM].map((o) => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
            </select>
            {task.remindTime && task.remind != null && (
              <TimeInput aria-label="שעת התזכורת" value={task.remindTime} onChange={(t) => t && set({ remindTime: t })} className={`${input} max-w-36`} />
            )}
          </div>
          {task.remind != null && <p className="mt-1 text-xs text-stone-500">ההתראה מגיעה לטלפון בזמן, גם כשהאפליקציה סגורה – אחרי "הפעלת התראות" בהגדרות (פעם אחת בכל מכשיר).</p>}
        </>
      )}

      <span className={label}>תתי משימות</span>
      <div className="space-y-2">
        {subs.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2">
            <input type="checkbox" checked={!!s.done} onChange={(e) => setSub(s.id, { done: e.target.checked, doneAt: e.target.checked ? Date.now() : null })} className="w-5 h-5 accent-violet-600 shrink-0" />
            <input value={s.title} onChange={(e) => setSub(s.id, { title: e.target.value })} className={`flex-1 min-w-0 outline-none ${s.done ? 'line-through text-stone-400' : ''}`} />
            <button
              type="button"
              title="רמת חשיבות"
              onClick={() => setSub(s.id, { priority: s.priority === 3 ? 1 : (s.priority || 2) + 1 })}
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${PRIORITIES[s.priority || 2].dot}`}
            />
            <label className="relative text-xs text-stone-500 shrink-0 rounded-lg bg-stone-100 px-2 py-1">
              {s.due ? shortDate(s.due) : 'דד ליין'}
              <input type="date" aria-label="דד ליין לתת משימה" value={s.due || ''} onChange={(e) => setSub(s.id, { due: e.target.value || null })} className="absolute inset-0 opacity-0" />
            </label>
            <button type="button" aria-label="הסרה" onClick={() => setSubs((list) => list.filter((x) => x.id !== s.id))} className="text-stone-400"><X size={18} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} placeholder="שלב נוסף..." className={input} />
          <button type="button" aria-label="הוספת תת משימה" onClick={addSub} className="rounded-xl bg-violet-100 text-violet-700 px-3"><Plus size={20} /></button>
        </div>
      </div>

      <span className={label}>אנשים / גורמים לבירור</span>
      <div className="space-y-2">
        {contacts.map((c, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2">
            <User size={18} className="text-stone-400 shrink-0" />
            <input value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} aria-label="שם" placeholder="שם" className="flex-1 min-w-0 bg-transparent outline-none" />
            <input value={c.phone || ''} onChange={(e) => setContact(i, { phone: e.target.value })} aria-label="טלפון" placeholder="טלפון" type="tel" dir="ltr" className="w-28 lg:w-36 min-w-0 bg-transparent outline-none text-left text-sm text-stone-600" />
            {telUrl(c.phone) && <a href={telUrl(c.phone)} aria-label={`חיוג ל${c.name}`} className="rounded-lg bg-emerald-50 text-emerald-700 p-1.5 shrink-0"><Phone size={16} /></a>}
            <button type="button" aria-label="הסרה" onClick={() => set({ contacts: contacts.filter((_, j) => j !== i) })} className="text-stone-400 shrink-0"><X size={18} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={newContact.name}
            onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContact(); } }}
            list="seder-contacts"
            placeholder="שם / גורם (למשל: קופת חולים)"
            className={`${input} min-w-0`}
          />
          <input
            value={newContact.phone}
            onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContact(); } }}
            placeholder={phoneFor(newContact.name) || 'טלפון'}
            type="tel"
            dir="ltr"
            className={`${input} text-left max-w-28 lg:max-w-40`}
          />
          <button type="button" aria-label="הוספת איש קשר" onClick={addContact} className="rounded-xl bg-violet-100 text-violet-700 px-3 shrink-0"><Plus size={20} /></button>
        </div>
        <datalist id="seder-contacts">
          {known.map((k) => <option key={k.name} value={k.name}>{k.phone}</option>)}
        </datalist>
      </div>

      <span className={label}>קישורים / סרטונים</span>
      <div className="space-y-2">
        {(task.links || []).map((l, i) => (
          <div key={l.url + i} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
            <span>{l.kind === 'video' ? '🎬' : '🔗'}</span>
            <a href={l.url} target="_blank" rel="noopener" dir="ltr" className="flex-1 truncate text-violet-700 underline text-left">{l.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
            <a href={l.url} target="_blank" rel="noopener" className="text-stone-400"><ExternalLink size={16} /></a>
            <button type="button" aria-label="הסרת קישור" onClick={() => set({ links: task.links.filter((_, j) => j !== i) })} className="text-stone-400"><X size={16} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={newLink} onChange={(e) => setNewLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="הדבקת קישור" dir="ltr" className={`${input} text-left`} />
          <button type="button" aria-label="הוספת קישור" onClick={addLink} className="rounded-xl bg-violet-100 text-violet-700 px-3"><Plus size={20} /></button>
        </div>
      </div>

      <span className={label}>תמונות וקבצים</span>
      <Attachments files={task.attachments} onChange={(fn) => setTask((t) => ({ ...t, attachments: fn(t.attachments) }))} />

      <span className={label}>הערות</span>
      <textarea value={task.notes} onChange={(e) => set({ notes: e.target.value })} rows={4} placeholder="פרטים, מחשבות, ממי מחכים לתשובה..." className={`${input} resize-y`} />
    </Sheet>
  );
}
