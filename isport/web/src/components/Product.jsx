// דף מוצר: תמונות, תיאור, התאמה אישית (לפי סוג הקטגוריה: שם, מספר, פאץ', שרוול) והערה למוכר.
// מוצר רגיל (נעליים, תיקים…) – בלי התאמה אישית; ההערה למוכר היא קוד המוצר.
// המידה והגרסה נבחרות ב-FlyLinking, לא כאן. "שמור" -> ההערה נוצרת ומועתקת -> "המשך ל-FlyLinking"
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Heart, MessageCircle, Share2 } from 'lucide-react';
import { copyText } from '../lib/api';
import { KIND_LABEL, buildNote, cleanName, cleanNumber, displayName, patchesFor, subtitle, templateInfo } from '../lib/shirt';
import { Chip, Field, ShirtCard, ShirtImage, inputClass, whatsappLink } from './ui';

export default function Product({ shirt, shirts, settings, fav, onFav }) {
  const [img, setImg] = useState(0);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [patch, setPatch] = useState('none');
  const [sleeve, setSleeve] = useState('short');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const noteRef = useRef(null);

  const t = templateInfo(shirt.template);
  const choice = { name, number, patch, sleeve };
  const current = buildNote(shirt, choice);
  // שינוי בבחירה אחרי השמירה -> צריך לשמור שוב
  const stale = t.custom && note && note !== current;
  // בלי התאמה אישית – ההערה (הקוד) מוכנה מיד
  const shown = t.custom ? note : current;

  useEffect(() => {
    document.title = `${shirt.team} ${shirt.type} ${shirt.year} – Isport`;
    return () => {
      document.title = 'Isport – חולצות כדורגל';
    };
  }, [shirt]);

  const save = async () => {
    setNote(current);
    setCopied(await copyText(current));
    setTimeout(() => noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const copy = async () => setCopied(await copyText(shown));

  // קישור רגיל (לא window.open) כדי שחוסם החלונות לא יעצור אותו; ההערה מועתקת שוב ברגע הלחיצה
  const proceed = () => {
    copyText(shown);
    setCopied(true);
  };

  const share = async () => {
    const url = window.location.href;
    const title = `${displayName(shirt)} ${subtitle(shirt)} – Isport`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await copyText(url);
    } catch {
      // המשתמש ביטל
    }
  };

  const related = shirts
    .filter((s) => s.id !== shirt.id && s.category === shirt.category && (s.team === shirt.team || (shirt.league && s.league === shirt.league)))
    .sort((a, b) => Number(b.team === shirt.team) - Number(a.team === shirt.team))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 lg:py-10">
      <nav className="mb-4 text-sm text-muted">
        <a href="#/" className="hover:underline">כל המוצרים</a>
        <span className="mx-1.5">/</span>
        <a href={`#/c/${shirt.category}`} className="hover:underline">{shirt.categoryName}</a>
        <span className="mx-1.5">/</span>
        <span>{displayName(shirt)}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
        <Gallery shirt={shirt} img={img} setImg={setImg} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black leading-tight lg:text-4xl">{displayName(shirt)}</h1>
              {shirt.teamHe && <div dir="ltr" className="text-right font-brand text-lg text-muted">{shirt.team.toUpperCase()}</div>}
              <div className="mt-1 text-lg">{subtitle(shirt)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={share} className="rounded-full p-2.5 ring-1 ring-line hover:bg-soft" aria-label="שיתוף">
                <Share2 size={20} />
              </button>
              <button onClick={onFav} className="rounded-full p-2.5 ring-1 ring-line hover:bg-soft" aria-label={fav ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}>
                <Heart size={20} className={fav ? 'fill-red-500 text-red-500' : ''} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {t.custom && <Tag>{KIND_LABEL[shirt.kind]}</Tag>}
            {(shirt.countryHe || shirt.country) && <Tag>{shirt.countryHe || shirt.country}</Tag>}
            {(shirt.leagueHe || shirt.league) && <Tag>{shirt.leagueHe || shirt.league}</Tag>}
            {(shirt.colorHe || shirt.color) && <Tag>{shirt.colorHe || shirt.color}</Tag>}
            <Tag mono>{shirt.code}</Tag>
          </div>

          {shirt.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted">{shirt.description}</p>}

          {t.custom && (
            <div className="mt-6 rounded-2xl bg-card p-4 ring-1 ring-line lg:p-5">
              <h2 className="mb-4 text-lg font-extrabold">התאמה אישית</h2>
              <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                <Field label="שם על הגב (לא חובה)">
                  <input value={name} onChange={(e) => setName(cleanName(e.target.value))} placeholder="ISRAEL" className={inputClass} maxLength={15} autoComplete="off" />
                </Field>
                <Field label="מספר (לא חובה)">
                  <input value={number} onChange={(e) => setNumber(cleanNumber(e.target.value))} placeholder="10" inputMode="numeric" className={`${inputClass} text-center`} />
                </Field>
              </div>

              {t.patches && (
                <div className="mt-4">
                  <div className="mb-1.5 text-sm font-medium text-muted">פאץ'</div>
                  <div className="flex flex-wrap gap-2">
                    {patchesFor(shirt).map((p) => (
                      <Chip key={p.id} active={patch === p.id} onClick={() => setPatch(p.id)}>{p.he}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {t.sleeves && shirt.longSleeve && (
                <div className="mt-4">
                  <div className="mb-1.5 text-sm font-medium text-muted">שרוול</div>
                  <div className="flex gap-2">
                    <Chip active={sleeve === 'short'} onClick={() => setSleeve('short')}>שרוול קצר</Chip>
                    <Chip active={sleeve === 'long'} onClick={() => setSleeve('long')}>שרוול ארוך</Chip>
                  </div>
                </div>
              )}

              {(name || number) && <BackPreview name={name} number={number} />}

              <button onClick={save} className="mt-5 w-full rounded-full bg-ink py-3.5 text-lg font-bold text-white hover:opacity-90 dark:bg-lime dark:text-ink">
                {note && !stale ? 'נשמר ✓' : 'שמור'}
              </button>
              <p className="mt-2 text-center text-xs text-muted">את המידה והגרסה בוחרים בעמוד הבא, ב-FlyLinking</p>
            </div>
          )}

          {shown && (
            <div ref={noteRef} className="mt-4 rounded-2xl border-2 border-lime-ink bg-card p-4 lg:p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-extrabold">{t.custom ? 'ההערה למוכר' : 'קוד המוצר למוכר'}</h2>
                {copied && !stale && (
                  <span className="flex items-center gap-1 text-sm font-bold text-lime-ink">
                    <Check size={16} /> הועתקה
                  </span>
                )}
              </div>
              {stale && <p className="mb-2 rounded-lg bg-soft p-2 text-sm">שיניתם את הבחירה – לחצו שוב "שמור" כדי לעדכן את ההערה.</p>}
              <pre dir="ltr" className="overflow-x-auto rounded-xl bg-page p-3 text-left font-mono text-sm leading-relaxed">{shown}</pre>
              <ol className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-muted">
                <li>לוחצים "המשך ל-FlyLinking" ({t.custom ? 'ההערה כבר מועתקת' : 'הקוד מועתק'}).</li>
                <li>בוחרים מידה{t.custom ? ' וגרסה' : ' וצבע'}.</li>
                <li>מדביקים את ההערה בשדה ההערות למוכר.</li>
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button onClick={copy} disabled={stale} className="flex items-center justify-center gap-2 rounded-full py-3 font-bold ring-1 ring-line hover:bg-soft disabled:opacity-40">
                  <Copy size={18} /> {t.custom ? 'העתק הערה' : 'העתק קוד'}
                </button>
                <a
                  href={stale ? undefined : shirt.flyLink}
                  onClick={proceed}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={stale}
                  className={`flex items-center justify-center gap-2 rounded-full bg-lime py-3 font-bold text-ink hover:brightness-95 ${stale ? 'pointer-events-none opacity-40' : ''}`}
                >
                  המשך ל-FlyLinking <ExternalLink size={18} />
                </a>
              </div>
            </div>
          )}

          {settings.whatsapp && (
            <a
              href={whatsappLink(settings.whatsapp, `היי, יש לי שאלה על ${shirt.code}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 text-sm text-muted hover:underline"
            >
              <MessageCircle size={16} /> שאלה על המוצר? כתבו לנו בוואטסאפ
            </a>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-black">עוד מוצרים שאולי תאהבו</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {related.map((s) => (
              <ShirtCard key={s.id} shirt={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tag({ children, mono }) {
  return (
    <span dir={mono ? 'ltr' : undefined} className={`rounded-full bg-soft px-2.5 py-1 font-medium ${mono ? 'font-mono' : ''}`}>
      {children}
    </span>
  );
}

function Gallery({ shirt, img, setImg }) {
  const count = Math.max(1, shirt.images?.length || 0);
  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl ring-1 ring-line">
        {/* בטלפון: גלילה הצידה בין התמונות */}
        <div
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          dir="ltr"
          onScroll={(e) => setImg(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          id="gallery"
        >
          {Array.from({ length: count }, (_, i) => (
            <ShirtImage key={i} shirt={shirt} index={i} className="aspect-square w-full shrink-0 snap-center" />
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2" dir="ltr">
          {shirt.images.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = document.getElementById('gallery');
                el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                setImg(i);
              }}
              className={`h-16 w-16 overflow-hidden rounded-xl ring-2 ${img === i ? 'ring-lime-ink' : 'ring-transparent opacity-70'}`}
              aria-label={`תמונה ${i + 1}`}
            >
              <ShirtImage shirt={shirt} index={i} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// תצוגה מקדימה של גב החולצה עם השם והמספר
function BackPreview({ name, number }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-soft p-3">
      <svg viewBox="0 0 64 64" className="h-24 w-24 shrink-0" aria-hidden="true">
        <path d="M24 10 L13 14.5 L6 26 L13.5 31 L17 27 L17 54 L47 54 L47 27 L50.5 31 L58 26 L51 14.5 L40 10 C38.5 12 35.5 13 32 13 C28.5 13 25.5 12 24 10 Z" className="fill-ink dark:fill-white" />
        {name && (
          <text x="32" y="23" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize={name.length > 9 ? 3.6 : 4.6} className="fill-lime dark:fill-ink">
            {name.toUpperCase()}
          </text>
        )}
        {number && (
          <text x="32" y="44" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize="17" className="fill-lime dark:fill-ink">
            {number}
          </text>
        )}
      </svg>
      <p className="text-sm text-muted">כך זה ייראה בערך על הגב. הצבעים והגופן האמיתיים – לפי החולצה.</p>
    </div>
  );
}
