// כרטיס קריינות / מוזיקה / אפקט מ-ElevenLabs: קודם הצעה (צורך קרדיטים במנוי), ורק "ליצור" מפעיל; אחר כך נגן והורדה
import { useState } from 'react';
import { AudioLines, Download, Music } from 'lucide-react';
import { api } from '../lib/api';
import { RELOAD } from './Gen';
import { Button, Spinner } from './ui';

export function AudioCard({ audio }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (path) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { id: audio.id });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
    window.dispatchEvent(new Event(RELOAD));
  };
  const Icon = audio.kind === 'voice' ? AudioLines : Music;
  const open = ['proposed', 'failed'].includes(audio.status);
  return (
    <div className="rounded-xl border border-line bg-page p-3 text-sm text-ink">
      <div className="flex items-start gap-2">
        <Icon size={18} className="mt-0.5 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{audio.summary}</div>
          <div className="text-xs text-muted">
            {audio.label}
            {audio.seconds ? ` · ${Math.round(audio.seconds)} שניות` : ''} · ElevenLabs
          </div>
        </div>
      </div>
      {audio.text && audio.status !== 'done' && (
        <p className="mt-2 rounded-lg bg-card p-2.5 whitespace-pre-line break-words" dir="auto">
          {audio.text}
        </p>
      )}

      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">משתמש בקרדיטים של המנוי שלך ב-ElevenLabs. שום דבר לא נוצר בלי אישור.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => act('/app/audio/approve')}>
              {busy ? 'רגע…' : audio.status === 'failed' ? 'לנסות שוב' : 'ליצור'}
            </Button>
            <Button kind="ghost" disabled={busy} onClick={() => act('/app/audio/cancel')}>
              לא עכשיו
            </Button>
          </div>
        </div>
      )}
      {audio.status === 'working' && (
        <div className="mt-3 flex items-center gap-2 text-muted">
          <Spinner /> {audio.kind === 'music' ? 'מלחין… זה יכול לקחת דקה-שתיים' : 'יוצר…'}
        </div>
      )}
      {audio.status === 'done' && audio.file && (
        <div className="mt-3 space-y-2">
          <audio controls preload="none" src={audio.file.url} className="w-full" />
          <a href={`${audio.file.url}&dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 font-medium !text-ink hover:bg-soft">
            <Download size={15} /> הורדה
          </a>
        </div>
      )}
      {audio.status === 'cancelled' && <div className="mt-2 text-muted">בוטל</div>}
      {(error || audio.error) && <div className="mt-2 text-bad">{error || audio.error}</div>}
    </div>
  );
}
