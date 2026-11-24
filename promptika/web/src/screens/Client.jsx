// כרטיס לקוח: שם ועסק (נשמרים), טופס הקליטה (9 חלקים) והצעות
import { ArrowRight, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { go } from '../lib/route';
import { countKinds, normalizeTool } from '../lib/proposals';
import Intake from '../components/Intake';
import { Button, Card, ErrorLine, Field, inputClass } from '../components/ui';

export default function Client({ id }) {
  const [client, setClient] = useState(null);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState('');
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    api('GET', `/clients/${id}`)
      .then((c) => {
        setClient(c.client);
        setName(c.client.name);
        setBusiness(c.client.business);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const { client: c } = await api('PUT', `/clients/${id}`, { client: { name, business } });
      setClient(c);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  // Claude ממליץ על מערכות לבנות; נשמר כגרסה חדשה בשרת
  async function propose() {
    setProposing(true);
    setProposeError('');
    try {
      const res = await api('POST', `/clients/${id}/propose`, {});
      setQuestions(res.missingQuestions || []);
      if (res.client) setClient((c) => ({ ...c, proposals: res.client.proposals }));
      else if (!res.proposal) setProposeError('לא נוצרו המלצות – חסר מידע. אפשר למלא את הטופס ולנסות שוב.');
    } catch (err) {
      setProposeError(err.message);
    } finally {
      setProposing(false);
    }
  }

  async function remove() {
    if (!window.confirm('למחוק את הלקוח? אי אפשר לבטל.')) return;
    try {
      await api('DELETE', `/clients/${id}`);
      go('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <a href="#/" className="inline-flex items-center gap-1 text-sm font-medium text-turq-ink">
        <ArrowRight size={16} aria-hidden />
        כל הלקוחות
      </a>
      <ErrorLine text={error} />
      {!client && !error && <p className="text-muted">טוען…</p>}
      {client && (
        <>
          <h1 className="text-2xl font-extrabold">{client.business || client.name}</h1>
          <div>
            <Card>
              <form onSubmit={save} className="space-y-3">
                <h2 className="font-bold">פרטים</h2>
                <Field label="שם איש הקשר">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="שם העסק">
                  <input className={inputClass} value={business} onChange={(e) => setBusiness(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">{saved ? 'נשמר ✓' : 'שמירה'}</Button>
                  <Button type="button" kind="danger" onClick={remove} className="ms-auto">
                    <Trash2 size={16} aria-hidden />
                    מחיקה
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <Intake key={id} clientId={id} serverIntake={client.intake} serverUpdatedAt={client.updatedAt} />

          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-bold">המלצות למערכות</h2>
              <Button className="ms-auto" onClick={propose} disabled={proposing}>
                <Sparkles size={18} aria-hidden />
                {proposing ? 'Claude חושב… (עד דקה)' : 'ליצור המלצות'}
              </Button>
            </div>
            <ErrorLine text={proposeError} />
            {questions.length > 0 && (
              <div className="rounded-lg border border-orange bg-soft p-3" role="status">
                <p className="font-bold text-orange-ink">כדאי להשלים לפני הסבב הבא:</p>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
                  {questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted">אפשר לעדכן את הטופס למעלה וללחוץ שוב "ליצור המלצות".</p>
              </div>
            )}
            {client.proposals.length === 0 ? (
              <p className="text-sm text-muted">מלאו את הטופס – במיוחד 'המערכות היום' ו'מערכות שהיה רוצה' – ולחצו 'ליצור המלצות'.</p>
            ) : (
              <ul className="space-y-3">
                {[...client.proposals].reverse().map((p) => {
                  const kinds = countKinds(p);
                  return (
                    <li key={p.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="font-bold">גרסה {p.version}</span>
                        {p.createdAt > 0 && <span className="text-muted">{new Date(p.createdAt).toLocaleDateString('he-IL')}</span>}
                        <span>{kinds.total} מערכות</span>
                        <span className="text-muted">{kinds.replace} להחלפה · {kinds.fresh} חדשות</span>
                        <a href={`#/client/${id}/proposal/${p.id}`} className="ms-auto font-bold text-turq-ink underline">לפתוח</a>
                      </div>
                      {p.understanding && <p className="mt-2 text-sm text-muted">{p.understanding}</p>}
                      {p.tools.length > 0 && (
                        <ol className="mt-2 space-y-1 text-sm">
                          {p.tools.map(normalizeTool).map((t, i) => (
                            <li key={i}>
                              <span className="font-bold">{i + 1}. {t.name}</span>
                              <span className="text-muted"> · {t.kind === 'replace' ? `במקום ${t.replaces || '…'}` : 'חדשה'}</span>
                              {t.problem && <span className="block text-muted">{t.problem}</span>}
                            </li>
                          ))}
                        </ol>
                      )}
                      {p.nextStep && <p className="mt-2 text-sm"><span className="font-bold text-turq-ink">צעד הבא: </span>{p.nextStep}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
