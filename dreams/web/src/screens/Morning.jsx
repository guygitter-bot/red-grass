import { useState } from 'react';
import Layout, { H2 } from '../components/Layout';
import DreamForm from '../components/DreamForm';
import { useApp } from '../context';
import { safeEntry } from '../lib/store';
import { nightKey } from '../lib/night';

// רישום בבוקר: קודם רגע של שקט ונזכרות, אחר כך כותבים
export default function Morning() {
  const { data, update, setToast } = useApp();
  const key = nightKey();
  const intention = data.nights[key] || null;
  const [step, setStep] = useState('still');

  const add = (entry) => {
    const e = safeEntry({ ...entry, night: key, at: Date.now() });
    update((d) => ({ ...d, entries: [e, ...d.entries] }));
    return e;
  };

  if (step === 'still') {
    return (
      <Layout title="בוקר" back="#/">
        <div className="max-w-xl mx-auto text-center pt-4">
          <p className="serif text-2xl lg:text-3xl font-bold leading-snug">עוד רגע לפני שזזים.</p>
          <p className="text-muted">
            להישאר באותה תנוחה, לעצום עיניים ולשאול: <span className="serif text-ink">מה חלמתי?</span> לתפוס קצה אחד – מקום, אדם, תחושה – ולתת לשאר להימשך אחריו. אם שום דבר לא עולה, לנסות להתהפך לתנוחה שבה ישנת.
          </p>
          {intention?.text && <p className="sheet p-4 serif">ביקשת: {intention.text}</p>}
          <div className="grid gap-3 mt-6">
            <button className="btn btn-dawn" onClick={() => setStep('write')}>נזכרתי – לרשום</button>
            <button
              className="btn"
              onClick={() => {
                add({ type: 'none' });
                setStep('none');
              }}
            >
              לא נזכרתי כלום הלילה
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (step === 'none') {
    return (
      <Layout title="בוקר" back="#/">
        <div className="max-w-xl mx-auto">
          <H2>נרשם. זה חלק מהאימון.</H2>
          <p className="text-muted">חלומות נמוגים מהר אחרי ההתעוררות. אלה ההמלצות המקובלות כדי לזכור יותר:</p>
          <ul className="ps-5 grid gap-1">
            <li>לפני השינה: להחליט בקול "בבוקר אזכור את החלום".</li>
            <li>לרשום כל בוקר – גם "לא זכרתי". יש עדויות שמי שמנהל יומן מדווח על יותר חלומות.</li>
            <li>בהתעוררות: לא לזוז ולא להסתכל בטלפון לפני שנזכרים.</li>
            <li>שעון מעורר עדין, או להתעורר בלי שעון בסוף השבוע – החלומות הארוכים הם לקראת הבוקר.</li>
          </ul>
          <div className="flex gap-2 flex-wrap mt-5">
            <a href="#/" className="btn btn-primary">חזרה</a>
            <button className="btn" onClick={() => setStep('write')}>בכל זאת עלה משהו</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="מה חלמתי" back="#/">
      <div className="max-w-2xl mx-auto">
        <DreamForm
          initial={safeEntry({ type: 'dream', night: key })}
          intention={intention}
          onSave={(f) => {
            // אם נרשם קודם "לא נזכרתי" לאותו לילה – מחליפים אותו
            const e = safeEntry({ ...f, night: key, at: Date.now() });
            update((d) => ({ ...d, entries: [e, ...d.entries.filter((x) => !(x.night === key && x.type === 'none'))] }));
            setToast('החלום נשמר ביומן');
            window.location.hash = `#/entry/${e.id}`;
          }}
        />
      </div>
    </Layout>
  );
}
