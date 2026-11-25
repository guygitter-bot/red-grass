import { useState } from 'react';
import { MOODS } from '../lib/store';
import { kindById } from '../lib/kinds';

const MOOD_NAMES = ['שמח', 'רגוע', 'ניטרלי', 'מודאג', 'מפחיד'];
const REL = [
  { id: 'yes', label: 'כן, על הנושא' },
  { id: 'partly', label: 'משהו קשור / ברמז' },
  { id: 'no', label: 'לא קשור' },
];

// טופס חלום – משמש גם לרישום בבוקר וגם לעריכה מהיומן
export default function DreamForm({ initial, intention, onSave, saveLabel = 'לשמור ביומן' }) {
  const [f, setF] = useState(initial);
  const [tagText, setTagText] = useState(initial.tags.join(', '));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const ask = intention && intention.kind !== 'recall';
  const showAnswer = ask && (f.related === 'yes' || f.related === 'partly' || intention.kind === 'problem');

  const save = () => {
    const tags = tagText.split(/[,،\n]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    onSave({ ...f, tags });
  };

  return (
    <div className="grid gap-6">
      {f.type === 'nap' && f.glimpses.length > 0 && (
        <section>
          <h3 className="font-bold m-0 mb-2">מה עלה בתנומה</h3>
          <ol className="m-0 ps-5 grid gap-1">
            {f.glimpses.map((g, i) => (
              <li key={i} className="serif">{g}</li>
            ))}
          </ol>
        </section>
      )}

      <label className="block">
        <span className="block font-bold mb-1">כותרת קצרה (לא חובה)</span>
        <input className="field serif" value={f.title} placeholder="למשל: הבית עם החדר הנוסף" onChange={(e) => set('title', e.target.value)} />
      </label>

      <label className="block">
        <span className="block font-bold mb-1">{f.type === 'nap' ? 'הערות' : 'החלום'}</span>
        <textarea
          className="field serif text-lg"
          rows={8}
          value={f.text}
          autoFocus={!f.text && f.type === 'dream'}
          placeholder="בזמן הווה, כמו שזה עולה: אני ב... יש שם... ההרגשה היא..."
          onChange={(e) => set('text', e.target.value)}
        />
        <span className="block text-sm text-muted mt-1">אפשר ללחוץ על המיקרופון שבמקלדת ולהכתיב. גם קטעים, צבעים ותחושות – הכול נחשב.</span>
      </label>

      {ask && (
        <fieldset className="border-0 p-0 m-0">
          <legend className="font-bold mb-1">
            האם החלום קשור לכוונה? <span className="font-normal text-muted">({intention.text || kindById(intention.kind).name})</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {REL.map((r) => (
              <button key={r.id} type="button" className="chip" aria-pressed={f.related === r.id} onClick={() => set('related', f.related === r.id ? null : r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted mt-2 mb-0">חלומות עונים לרוב בדימויים ולא במילים. משהו שנראה צדדי יכול להיות התשובה.</p>
        </fieldset>
      )}

      {showAnswer && (
        <label className="block sheet p-4 bg-dawn-soft">
          <span className="block font-bold mb-1">אם החלום היה תשובה – מה הוא אומר?</span>
          <span className="block text-sm text-muted mb-2">מה הרגשת בחלום? מי או מה הופיע שם שקשור לשאלה? איזו פעולה עשית? מה היית עושה אחרת מחר בעקבותיו?</span>
          <textarea className="field" rows={4} value={f.answer} onChange={(e) => set('answer', e.target.value)} />
        </label>
      )}

      <fieldset className="border-0 p-0 m-0">
        <legend className="font-bold mb-1">התחושה בחלום</legend>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m, i) => (
            <button key={m} type="button" className="chip" aria-pressed={f.mood === i} aria-label={MOOD_NAMES[i]} title={MOOD_NAMES[i]} onClick={() => set('mood', f.mood === i ? null : i)}>
              <span className="text-xl" aria-hidden="true">{m}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-0 p-0 m-0">
        <legend className="font-bold mb-1">כמה ברור זכרת</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="chip w-11 justify-center" aria-pressed={f.clarity === n} onClick={() => set('clarity', f.clarity === n ? null : n)}>
              {n}
            </button>
          ))}
          <span className="self-center text-sm text-muted">1 = רק תחושה · 5 = כמו סרט</span>
        </div>
      </fieldset>

      <label className="flex items-center gap-3 min-h-11">
        <input type="checkbox" className="w-5 h-5 accent-[var(--color-accent)]" checked={f.lucid} onChange={(e) => set('lucid', e.target.checked)} />
        <span>ידעתי בתוך החלום שאני חולם/ת (חלום צלול)</span>
      </label>

      <label className="block">
        <span className="block font-bold mb-1">סמלים ותגיות</span>
        <input className="field" value={tagText} placeholder="ים, בית ילדות, אבא, טיסה" onChange={(e) => setTagText(e.target.value)} />
        <span className="block text-sm text-muted mt-1">מופרדים בפסיק. בתובנות יופיעו הסמלים שחוזרים אצלך.</span>
      </label>

      <button className="btn btn-primary w-full" onClick={save}>
        {saveLabel}
      </button>
    </div>
  );
}
