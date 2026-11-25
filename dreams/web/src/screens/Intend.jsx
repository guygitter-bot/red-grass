import { useState } from 'react';
import Layout, { H2 } from '../components/Layout';
import { useApp } from '../context';
import { KINDS, kindById, makePhrase } from '../lib/kinds';
import { upcomingNight, nightLabel } from '../lib/night';

// בחירת הכוונה ללילה: סוג, שאלה, משפט קצר ותמונה אחת
export default function Intend() {
  const { data, update } = useApp();
  const key = upcomingNight();
  const cur = data.nights[key];
  const [kind, setKind] = useState(cur?.kind || 'problem');
  const [text, setText] = useState(cur?.text || '');
  const [phrase, setPhrase] = useState(cur?.phrase || '');
  const [phraseEdited, setPhraseEdited] = useState(Boolean(cur?.phrase));
  const [image, setImage] = useState(cur?.image || '');
  const k = kindById(kind);
  const shown = phraseEdited ? phrase : makePhrase(kind, text);
  const needsText = kind !== 'recall' && kind !== 'lucid';
  const ready = !needsText || text.trim();

  const save = () => {
    update((d) => ({
      ...d,
      nights: { ...d.nights, [key]: { kind, text: text.trim(), phrase: shown.trim() || makePhrase(kind, text), image: image.trim(), ritual: cur?.ritual || false, at: Date.now() } },
      settings: { ...d.settings, seenIntro: true },
    }));
    window.location.hash = '#/ritual';
  };

  return (
    <Layout title="כוונה ללילה" back="#/">
      <div className="max-w-2xl mx-auto">
        <p className="text-muted mt-0">{nightLabel(key)}</p>

        <H2>על מה לחלום?</H2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-6" role="group" aria-label="סוג הכוונה">
          {KINDS.map((x) => (
            <button key={x.id} aria-pressed={kind === x.id} className="chip !rounded-2xl !items-start flex-col text-start p-3" onClick={() => setKind(x.id)}>
              <span className="font-bold"><span aria-hidden="true">{x.icon}</span> {x.name}</span>
              <span className="text-xs text-muted font-normal">{x.hint}</span>
            </button>
          ))}
        </div>

        {kind !== 'recall' && (
          <label className="block mb-5">
            <span className="block font-bold mb-1">{kind === 'lucid' ? 'מה לעשות בחלום הצלול? (לא חובה)' : 'הנושא או השאלה'}</span>
            <textarea className="field" rows={2} value={text} placeholder={k.placeholder} onChange={(e) => setText(e.target.value)} />
            {kind === 'problem' && <span className="block text-sm text-muted mt-1">עדיף שאלה אחת, ממוקדת, שחשבת עליה גם במהלך היום.</span>}
          </label>
        )}

        <label className="block mb-5">
          <span className="block font-bold mb-1">המשפט לחזור עליו לפני השינה</span>
          <input
            className="field serif text-lg"
            value={shown}
            onChange={(e) => {
              setPhrase(e.target.value);
              setPhraseEdited(true);
            }}
          />
          <span className="block text-sm text-muted mt-1">קצר, בגוף ראשון ובזמן עתיד. אפשר לערוך.</span>
        </label>

        {kind !== 'recall' && (
          <label className="block mb-6">
            <span className="block font-bold mb-1">תמונה אחת שמייצגת את זה (לא חובה)</span>
            <input className="field" value={image} placeholder="למשל: מפתח זהב על שולחן, הים של חיפה" onChange={(e) => setImage(e.target.value)} />
            <span className="block text-sm text-muted mt-1">בטקס השינה מדמיינים אותה. תמונה מוחשית עוזרת למוח לקחת את הנושא איתו לשינה.</span>
          </label>
        )}

        <button className="btn btn-primary w-full" disabled={!ready} onClick={save}>
          לשמור ולעבור לטקס השינה
        </button>
        {cur && (
          <button
            className="btn w-full mt-3"
            onClick={() => {
              update((d) => {
                const nights = { ...d.nights };
                delete nights[key];
                return { ...d, nights };
              });
              window.location.hash = '#/';
            }}
          >
            לבטל את הכוונה של הלילה
          </button>
        )}
      </div>
    </Layout>
  );
}
