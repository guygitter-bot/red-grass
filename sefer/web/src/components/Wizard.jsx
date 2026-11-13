import { useEffect, useMemo, useRef, useState } from 'react';
import { go } from '../lib/nav';
import { OCCASIONS, TONES, STYLES, LENGTHS, MAX_PHOTOS, questionsFor, emptyBrief, defaultsFor, answered, briefProblem, isRomance } from '../lib/brief';
import { getOutline } from '../lib/api';
import { makeBook } from '../lib/book';
import { saveBook, saveImage } from '../lib/store';
import { fileToImage, dataUrl } from '../lib/image';
import { run } from '../lib/maker';
import { Chips, ErrorBox, TopBar } from './ui';

const DRAFT = 'sefer-ishi-draft';
const STEPS = ['האירוע', 'על מי הספר', 'ספרו לנו', 'איך הספר ייראה'];

// טיוטה: מה שכבר מולא נשמר במכשיר (בלי התמונות), כדי שלא יאבד אם סוגרים באמצע
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
    if (d && typeof d === 'object') return { brief: { ...emptyBrief(), ...d.brief }, texts: Array.isArray(d.texts) ? d.texts : [], step: Number(d.step) || 0, art: d.art !== false };
  } catch { /* טיוטה פגומה – מתחילים מחדש */ }
  return { brief: emptyBrief(), texts: [], step: 0, art: true };
}

// השאלון: 4 צעדים קצרים, ובסוף הסופר בונה את מתווה הספר
export default function Wizard() {
  const first = useMemo(loadDraft, []);
  const [step, setStep] = useState(first.step);
  const [brief, setBrief] = useState(first.brief);
  const [texts, setTexts] = useState(first.texts); // התשובות לפי מספר השאלה
  const [photos, setPhotos] = useState([]);
  const [coverKind, setCoverKind] = useState('art');
  const [usePhoto, setUsePhoto] = useState(true);
  const [art, setArt] = useState(first.art);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const questions = questionsFor(brief.occasion, brief.name.trim());
  const romance = isRomance(brief);
  const set = (patch) => setBrief((b) => ({ ...b, ...patch }));

  useEffect(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ brief, texts, step, art })); } catch { /* אין מקום – לא נורא */ }
  }, [brief, texts, step, art]);

  const full = { ...brief, answers: answered(questions, texts) };
  // מה חסר בצעד הנוכחי (מונע מעבר הלאה)
  const missing = step === 0 ? (brief.occasion ? '' : 'בחרו אירוע') : step === 1 ? (!brief.name.trim() ? (romance ? 'כתבו את שמות הדמויות' : 'כתבו על מי הספר') : romance && !brief.adult ? 'צריך לאשר שאתם מעל גיל 18' : '') : step >= 2 ? briefProblem(full) : '';

  async function addPhotos(files) {
    setError(null);
    try {
      const added = [];
      for (const f of [...files].slice(0, MAX_PHOTOS - photos.length)) added.push(await fileToImage(f));
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError({ message: e.message });
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const outline = await getOutline(full);
      const book = makeBook(full, outline, { photos: photos.length, coverKind, usePhoto, art });
      for (let i = 0; i < book.photos; i++) await saveImage(book.id, `p${i}`, { media_type: photos[i].media_type, data: photos[i].data });
      await saveBook(book);
      try { localStorage.removeItem(DRAFT); } catch { /* לא נורא */ }
      run(book.id); // הכריכה מצוירת ברקע
      go(`book/${book.id}`);
    } catch (e) {
      setError({ message: e.message, detail: e.detail });
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="spinner" />
        <h1 className="book-title text-2xl m-0">{romance ? `הסופר בונה את הסיפור של ${brief.name}` : `הסופר בונה את הספר של ${brief.name}`}</h1>
        <p className="text-muted m-0">בוחר שם לספר ומתכנן את הפרקים. זה לוקח עד דקה.</p>
      </main>
    );
  }

  return (
    <>
      <TopBar title={`ספר חדש · ${STEPS[step]}`} onBack={() => (step ? setStep(step - 1) : go(''))} />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-32">
        <div className="flex gap-1.5 mb-5" aria-label={`צעד ${step + 1} מתוך ${STEPS.length}`}>
          {STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />)}
        </div>

        {step === 0 ? (
          <section>
            <h2 className="book-title text-2xl mt-0 mb-1">לאיזה אירוע הספר?</h2>
            <p className="text-muted mt-0 mb-4">משם אנחנו ממשיכים צעד אחרי צעד. זה לוקח 5–10 דקות.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {OCCASIONS.map((o) => (
                <button
                  key={o.id} type="button" aria-pressed={brief.occasion === o.id}
                  className={`text-right rounded-2xl border p-3 bg-card ${brief.occasion === o.id ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
                  onClick={() => { set({ occasion: o.id, adult: false, ...defaultsFor(o.id) }); setStep(1); }}
                >
                  <div className="text-3xl" aria-hidden="true">{o.icon}</div>
                  <div className="font-bold mt-1">{o.label}</div>
                  <div className="text-xs text-muted">{o.hint}</div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 && romance ? (
          <section className="grid gap-4">
            <div>
              <h2 className="book-title text-2xl m-0">רומן למבוגרים</h2>
              <p className="text-muted mt-1 mb-0">נותנים סיפור מסגרת ומתארים את הדמויות, והסופר כותב רומן רומנטי-חושני: מתח, משיכה ואווירה. הרגעים האינטימיים נכתבים ברמז, בלי תיאור מפורש, וגם האיורים מרומזים בלבד.</p>
            </div>
            <label>
              <span className="label">שמות הדמויות הראשיות</span>
              <input className="field" value={brief.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="למשל: מאיה ואורי" />
            </label>
            <div className="bg-card border border-line rounded-2xl p-4 grid gap-3">
              <ul className="m-0 pr-5 text-sm text-muted grid gap-1">
                <li>הדמויות בדויות: לא אנשים אמיתיים, ולא מעלים תמונות.</li>
                <li>כל הדמויות בגירות (18 ומעלה), והקשר ביניהן בהסכמה.</li>
              </ul>
              <label className="flex items-start gap-2 font-semibold">
                <input type="checkbox" className="mt-1.5" checked={brief.adult === true} onChange={(e) => set({ adult: e.target.checked })} />
                <span>אני מעל גיל 18</span>
              </label>
            </div>
          </section>
        ) : null}

        {step === 1 && !romance ? (
          <section className="grid gap-4">
            <h2 className="book-title text-2xl m-0">על מי הספר?</h2>
            <label>
              <span className="label">השם שיופיע בספר</span>
              <input className="field" value={brief.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder={brief.occasion === 'wedding' || brief.occasion === 'anniversary' ? 'למשל: נועה ואיתי' : 'למשל: סבא יוסי'} />
            </label>
            <div>
              <span className="label">איך לכתוב עליו/ה?</span>
              <Chips label="לשון הכתיבה" value={brief.gender} onChange={(gender) => set({ gender })} options={[{ id: 'm', label: 'בלשון זכר' }, { id: 'f', label: 'בלשון נקבה' }]} />
            </div>
            <label>
              <span className="label">מי הוא/היא בשבילכם? <span className="font-normal text-muted">(לא חובה)</span></span>
              <input className="field" value={brief.relation} maxLength={80} onChange={(e) => set({ relation: e.target.value })} placeholder="אמא שלי, החבר הכי טוב, הבן שלנו..." />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">גיל <span className="font-normal text-muted">(לא חובה)</span></span>
                <input className="field" value={brief.age} maxLength={20} inputMode="numeric" onChange={(e) => set({ age: e.target.value })} />
              </label>
              <label>
                <span className="label">ממי הספר?</span>
                <input className="field" value={brief.from} maxLength={80} onChange={(e) => set({ from: e.target.value })} placeholder="השם שלכם" />
              </label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="book-title text-2xl m-0">{romance ? 'הסיפור והדמויות' : `ספרו לנו על ${brief.name}`}</h2>
              <p className="text-muted mt-1 mb-0">אין חובה לענות על הכול, אבל כל פרט שתכתבו ייכנס לספר. כתבו חופשי, כמו שמספרים לחבר.</p>
            </div>
            {questions.map((q, i) => (
              <label key={q}>
                <span className="label">{q}</span>
                <textarea className="field" rows={3} maxLength={1500} value={texts[i] || ''} onChange={(e) => setTexts((t) => { const n = [...t]; n[i] = e.target.value; return n; })} />
              </label>
            ))}
            {romance ? null : (
              <div>
                <span className="label">באיזה טון לכתוב?</span>
                <Chips label="טון" value={brief.tone} onChange={(tone) => set({ tone })} options={TONES} />
              </div>
            )}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="grid gap-5">
            <h2 className="book-title text-2xl m-0">איך הספר ייראה?</h2>
            {romance ? <p className="text-sm text-muted m-0">האיורים בקטגוריה הזאת מרומזים בלבד, של דמויות מצוירות.</p> : null}
            <div hidden={romance}>
              <span className="label">תמונות <span className="font-normal text-muted">(לא חובה, עד {MAX_PHOTOS})</span></span>
              <p className="text-sm text-muted mt-0 mb-2">התמונה הראשונה היא של גיבור/ת הספר. שאר התמונות יופיעו באלבום בסוף הספר.</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.data.slice(0, 40) + i} className="relative w-20 h-20">
                    <img src={dataUrl(p)} alt={`תמונה ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-line" />
                    <button type="button" aria-label={`הסרת תמונה ${i + 1}`} className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-card border border-line text-sm" onClick={() => setPhotos((all) => all.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <button type="button" className="w-20 h-20 rounded-xl border border-dashed border-line bg-card text-sm text-muted" onClick={() => fileRef.current?.click()}>+ תמונה</button>
                ) : null}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              {photos.length ? (
                <div className="grid gap-2 mt-3">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1.5" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} />
                    <span>לאייר את הדמות לפי התמונה הראשונה <span className="text-sm text-muted block">התמונה נשלחת למאייר (Google) רק לצורך האיור.</span></span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1.5" checked={coverKind === 'photo'} onChange={(e) => setCoverKind(e.target.checked ? 'photo' : 'art')} />
                    <span>להשתמש בתמונה הראשונה ככריכה (במקום כריכה מאוירת)</span>
                  </label>
                </div>
              ) : null}
            </div>
            <div>
              <span className="label">סגנון האיורים</span>
              <Chips label="סגנון האיורים" value={brief.style} onChange={(style) => set({ style })} options={romance ? STYLES.filter((s) => s.id !== 'storybook') : STYLES} />
              <label className="flex items-center gap-2 mt-3">
                <input type="checkbox" checked={art} onChange={(e) => setArt(e.target.checked)} />
                <span>איור לכל פרק</span>
              </label>
            </div>
            <div>
              <span className="label">אורך הספר</span>
              <Chips label="אורך הספר" value={brief.length} onChange={(length) => set({ length })} options={LENGTHS} />
            </div>
            <label>
              <span className="label">הקדשה אישית <span className="font-normal text-muted">(לא חובה – אם לא תכתבו, הסופר יכתוב)</span></span>
              <textarea className="field" rows={3} maxLength={600} value={brief.dedication} onChange={(e) => set({ dedication: e.target.value })} />
            </label>
          </section>
        ) : null}

        <div className="mt-4"><ErrorBox error={error?.message} detail={error?.detail} /></div>
      </main>

      {step > 0 ? (
        <div className="fixed bottom-0 inset-x-0 bg-page/95 backdrop-blur border-t border-line">
          <div className="mx-auto max-w-2xl px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {missing ? <div className="text-sm text-muted mb-2 text-center">{missing}</div> : null}
            {step < 3 ? (
              <button type="button" className="btn btn-main w-full" disabled={Boolean(missing)} onClick={() => setStep(step + 1)}>המשך</button>
            ) : (
              <button type="button" className="btn btn-main w-full" disabled={Boolean(missing)} onClick={create}>צרו לי את הספר</button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
