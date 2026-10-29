// ייבוא מקובץ האקסל: הקובץ נקרא בטלפון/במחשב (לא נשלח לשום מקום), מוצג סיכום, ורק אחרי אישור נשמר
import { useEffect, useState } from 'react';
import { monthName } from '../lib/budget';
import { buildImport } from '../lib/excelImport';
import { readXlsx } from '../lib/xlsx';
import { save } from '../lib/store';
import { Button, Sheet } from './ui';

export default function ImportExcel({ file, onClose, onDone }) {
  const [state, setState] = useState({ status: 'reading' });

  useEffect(() => {
    let alive = true;
    file
      .arrayBuffer()
      .then(readXlsx)
      .then((sheets) => {
        const result = buildImport(sheets);
        if (!result.months.length && !result.cards) throw new Error('empty');
        if (alive) setState({ status: 'ready', result });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [file]);

  const r = state.result;
  return (
    <Sheet title="ייבוא מאקסל" onClose={onClose}>
      {state.status === 'reading' && <p className="text-muted">קורא את הקובץ…</p>}
      {state.status === 'error' && (
        <p className="text-minus">לא הצלחתי לקרוא את הקובץ. צריך קובץ אקסל (‎.xlsx) עם גיליון לכל חודש (בשם כמו "08.26") ועמודות "סכום" ו"פירוט".</p>
      )}
      {state.status === 'ready' && (
        <>
          <div className="mb-4 space-y-1 rounded-2xl bg-soft p-4 text-sm">
            {r.months.length > 0 && (
              <div>
                <b>{r.months.length} חודשים:</b> {monthName(r.months[0])} – {monthName(r.months[r.months.length - 1])}
              </div>
            )}
            <div>הכנסות: {r.counts.income}</div>
            <div>הוצאות קבועות: {r.counts.fixed}</div>
            <div>תשלומים והלוואות: {r.counts.installments}</div>
            <div>הוצאות חד־פעמיות: {r.counts.once}</div>
            {r.cards > 0 && <div>מעקב כרטיסי אשראי: {r.cardNames.join(', ')}</div>}
          </div>
          <ul className="mb-4 list-disc space-y-1 pr-5 text-sm text-muted">
            <li>מה שמסומן "קבוע" (או מופיע בכמה חודשים) – נכנס כהוצאה/הכנסה קבועה, וממשיך גם לחודשים הבאים.</li>
            <li>"3/10" – נכנס כתשלומים, עד התשלום האחרון.</li>
            <li>בכל חודש שבו הסכום באקסל היה אחר – נשמר הסכום של אותו חודש.</li>
            <li>ייבוא נוסף של אותו קובץ מעדכן את מה שיובא קודם ולא מכפיל.</li>
          </ul>
          <Button
            className="w-full"
            onClick={() => {
              save(r.records);
              onDone(`יובאו ${r.records.length} רשומות מהאקסל`);
            }}
          >
            ייבוא
          </Button>
        </>
      )}
    </Sheet>
  );
}
