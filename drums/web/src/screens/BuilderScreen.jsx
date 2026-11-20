import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import KitStage from '../components/KitStage';
import Stepper from '../components/Stepper';
import { applyChars, buildPieces, KICK_CHARS, optionsFromPieces, safeKit, safeOptions, safeVoice, SNARE_CHARS } from '../lib/kit';

function Toggle({ label, on, onChange }) {
  return (
    <button type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
      {on && <Icon name="check" size={14} />}{label}
    </button>
  );
}

function Chars({ title, chars, value, onChange }) {
  return (
    <div>
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {Object.entries(chars).map(([id, c]) => (
          <button key={id} type="button" className={`chip ${value === id ? 'on' : ''}`} aria-pressed={value === id} onClick={() => onChange(id)}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// בניית סט: אפשרויות בצד, תצוגה חיה (אפשר לנגן עליה) למעלה. base = סט לעריכה (שמור שלי / מפורסם / ריק)
export default function BuilderScreen({ base, onSave }) {
  const editing = base?.custom ? base : null;
  const [opts, setOpts] = useState(() => (base ? (base.options ? safeOptions(base.options) : optionsFromPieces(base.pieces)) : safeOptions()));
  const [name, setName] = useState(() => (editing ? editing.name : base ? `${base.name} – שלי` : ''));
  const baseVoice = useMemo(() => safeVoice(base ? (editing ? editing.baseVoice : base.voice) : null), [base, editing]);
  const set = (patch) => setOpts((o) => safeOptions({ ...o, ...patch }));

  const preview = useMemo(
    () => ({ id: 'preview', name: 'תצוגה', pieces: buildPieces(opts), voice: applyChars(baseVoice, opts) }),
    [opts, baseVoice],
  );

  const save = () => {
    const kit = safeKit({
      id: editing?.id,
      name: name || 'הסט שלי',
      desc: base && !editing ? `התחיל מ${base.name}` : editing?.desc || '',
      options: opts,
      baseVoice,
      // הסט המפורסם שממנו התחלנו (לרשימת השירים שלו)
      baseId: editing ? editing.baseId : base?.id,
    });
    onSave(kit);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row short:flex-row">
      <div className="h-[34%] min-h-[190px] lg:h-auto lg:flex-1 lg:order-2 flex flex-col short:h-auto short:flex-1 short:order-2 border-b lg:border-b-0 lg:border-e short:border-b-0 short:border-e border-line">
        <KitStage kit={preview} />
      </div>
      <div className="flex-1 lg:flex-none lg:w-[380px] short:flex-none short:w-[330px] lg:order-1 short:order-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        <header>
          <h1 className="font-display text-5xl leading-none">{editing ? 'עריכת סט' : 'בניית סט'}</h1>
          <p className="text-muted text-sm">בחרו חלקים וצליל. אפשר ללחוץ על החלקים בתצוגה ולשמוע.</p>
        </header>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">שם הסט</span>
          <input className="input" value={name} maxLength={40} placeholder="הסט שלי" onChange={(e) => setName(e.target.value)} />
        </label>
        <section className="rounded-2xl bg-card border border-line px-4 py-2 divide-y divide-line">
          <Stepper label="טומים" value={opts.toms} min={0} max={4} onChange={(v) => set({ toms: v })} />
          <Stepper label="טומי רצפה" value={opts.floors} min={0} max={2} onChange={(v) => set({ floors: v })} />
          <Stepper label="קראש" value={opts.crashes} min={0} max={2} onChange={(v) => set({ crashes: v })} />
        </section>
        <div className="flex flex-wrap gap-2">
          <Toggle label="רייד" on={opts.ride} onChange={(v) => set({ ride: v })} />
          <Toggle label="צ׳יינה" on={opts.china} onChange={(v) => set({ china: v })} />
          <Toggle label="ספלאש" on={opts.splash} onChange={(v) => set({ splash: v })} />
          <Toggle label="פעמון" on={opts.cowbell} onChange={(v) => set({ cowbell: v })} />
          <Toggle label="בס כפול" on={opts.doubleKick} onChange={(v) => set({ doubleKick: v })} />
        </div>
        <Chars title="צליל הבס" chars={KICK_CHARS} value={opts.kickChar} onChange={(v) => set({ kickChar: v })} />
        <Chars title="צליל הסנר" chars={SNARE_CHARS} value={opts.snareChar} onChange={(v) => set({ snareChar: v })} />
        <button type="button" className="btn btn-primary" onClick={save}><Icon name="save" size={18} /> שמירה ונגינה</button>
      </div>
    </div>
  );
}
