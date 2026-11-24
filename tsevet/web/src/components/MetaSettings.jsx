// הגדרות ← פייסבוק ואינסטגרם: חיבור חד-פעמי (אפליקציה ב-Meta + "התחברות עם פייסבוק"), כדי ש-📱 סושיאל יפרסם באישור
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { api } from '../lib/api';
import { copyText } from '../lib/copy';
import { Button, Spinner, inputCls } from './ui';

export default function MetaSettings() {
  const [s, setS] = useState(null);
  const [appId, setAppId] = useState('');
  const [secret, setSecret] = useState('');
  const [configId, setConfigId] = useState('');
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api('/app/meta/status', {})
      .then((r) => {
        setS(r);
        setAppId(r.appId);
        setConfigId(r.configId || '');
      })
      .catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api('/app/meta/app', { appId, secret, configId });
      setSecret('');
      setEdit(false);
      await load();
    } catch (err) {
      setMsg(err.message);
    }
  };
  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api('/app/meta/start', {});
      location.href = url;
    } catch (e) {
      setMsg(e.message);
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!confirm('לנתק את פייסבוק ואינסטגרם? סושיאל לא יוכל לפרסם עד שתתחבר שוב.')) return;
    await api('/app/meta/disconnect', {}).catch(() => {});
    load();
  };

  if (!s) return <Spinner />;
  const connected = s.pages.length > 0;
  return (
    <div className="space-y-3 text-sm">
      {connected ? (
        <>
          <ul className="space-y-1">
            {s.pages.map((p) => (
              <li key={p.id} className="rounded-lg bg-soft px-3 py-2">
                <span className="font-medium">פייסבוק: {p.name}</span>
                <span className="text-muted"> · {p.ig ? `אינסטגרם: @${p.ig.username}` : 'בלי אינסטגרם מקושר'}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">📱 סושיאל יכול להציע פוסטים ורילס, וכל אחד עולה רק אחרי שתאשר בכרטיס בשיחה.</p>
          <div className="flex flex-wrap gap-2">
            <Button kind="ghost" disabled={busy} onClick={connect}>
              לחבר מחדש / עמוד אחר
            </Button>
            <Button kind="ghost" onClick={disconnect}>
              לנתק
            </Button>
          </div>
        </>
      ) : s.configured && !edit ? (
        <>
          <p>האפליקציה של Meta מוגדרת. עכשיו מתחברים ומסמנים את העמוד (ואת האינסטגרם המקושר אליו).</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={connect}>
              {busy ? 'פותח…' : 'התחברות עם פייסבוק'}
            </Button>
            <Button kind="ghost" onClick={() => setEdit(true)}>
              לשנות את פרטי האפליקציה
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <ol className="list-decimal space-y-1 ps-5 text-xs text-muted">
            <li>האינסטגרם צריך להיות חשבון עסקי או יוצר, ומקושר לעמוד הפייסבוק.</li>
            <li>
              ב-
              <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="!text-accent-ink underline">
                developers.facebook.com/apps
              </a>{' '}
              יוצרים אפליקציה מסוג "Business", ומוסיפים לה "Facebook Login for Business" ו-"Instagram".
            </li>
            <li>
              בהגדרות ההתחברות מדביקים את כתובת החזרה:
              <button type="button" onClick={() => copyText(s.redirect)} className="ms-1 inline-flex items-center gap-1 rounded bg-soft px-1.5 py-0.5 font-mono text-[11px] text-ink" dir="ltr">
                {s.redirect} <Copy size={11} />
              </button>
            </li>
            <li>ב-App settings ← Basic מעתיקים לכאן את ה-App ID ואת ה-App Secret.</li>
            <li>ב-Facebook Login for Business ← Configurations יוצרים הגדרה עם ההרשאות לעמודים ולאינסטגרם, ומעתיקים את ה-Configuration ID.</li>
          </ol>
          <input className={inputCls} dir="ltr" inputMode="numeric" placeholder="App ID" value={appId} onChange={(e) => setAppId(e.target.value.trim())} />
          <input className={inputCls} dir="ltr" type="password" autoComplete="off" placeholder={s.configured ? 'App Secret (ריק = בלי שינוי)' : 'App Secret'} value={secret} onChange={(e) => setSecret(e.target.value.trim())} />
          <input className={inputCls} dir="ltr" inputMode="numeric" placeholder="Configuration ID" value={configId} onChange={(e) => setConfigId(e.target.value.trim())} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!appId || (!secret && !s.configured)}>שמירה</Button>
            {s.configured && (
              <Button type="button" kind="ghost" onClick={() => setEdit(false)}>
                ביטול
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">הסוד נשמר רק בשרת שלך ולא מוצג שוב. לא צריך אף סיסמה של פייסבוק או אינסטגרם.</p>
        </form>
      )}
      {msg && <p className="text-bad">{msg}</p>}
    </div>
  );
}
