import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import { grooveFor } from '../data/grooves';
import { CATEGORIES, EXERCISES, exerciseKey } from '../data/rudiments';
import { songById } from '../data/songs';
import { dayKey, prevDay, STAR_RULES, streakOf, suggestNext, totalMinutes, totalStars } from '../lib/progress';
import { loadProgress } from '../lib/storage';

// מסך "אימון": לשונית "טכניקה" (תרגילי ידיים על מנוע הלימוד) ולשונית "התקדמות" (רצף, דקות, כוכבים והצעה הבאה)
export default function TrainScreen({ onPractice, onLearnSong, initialTab = 'tech' }) {
  const [tab, setTab] = useState(initialTab);
  const progress = useMemo(loadProgress, []);
  return (
    <div className="floor flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-5 pb-8 flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="poster text-7xl">אימון</h1>
            <p className="text-muted text-sm mt-1">תרגילי ידיים בקצב עולה, וכוכבים על כל מה שתרגלתם.</p>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="אימון">
            <button type="button" role="tab" aria-selected={tab === 'tech'} className={`chip !min-h-11 ${tab === 'tech' ? 'on' : ''}`} onClick={() => setTab('tech')}><Icon name="drum" size={18} />טכניקה</button>
            <button type="button" role="tab" aria-selected={tab === 'progress'} className={`chip !min-h-11 ${tab === 'progress' ? 'on' : ''}`} onClick={() => setTab('progress')}><Icon name="star" size={18} />התקדמות</button>
          </div>
        </header>
        {tab === 'tech' ? <Technique progress={progress} onPractice={onPractice} /> : <Progress progress={progress} onPractice={onPractice} onLearnSong={onLearnSong} />}
      </div>
    </div>
  );
}

function Technique({ progress, onPractice }) {
  return (
    <>
      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="flex flex-col gap-2" aria-label={cat.name}>
          <h2 className="poster text-4xl">{cat.name}</h2>
          <ul className="case flex flex-col divide-y divide-line">
            {EXERCISES.filter((e) => e.cat === cat.id).map((e) => {
              const it = progress.items[exerciseKey(e.id)];
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2.5" data-exercise={e.id}>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold flex items-center gap-2 flex-wrap">
                      {e.name}
                      <Stars n={it?.stars || 0} />
                    </p>
                    <p className="text-xs text-muted leading-snug">{e.desc}</p>
                    <p className="text-[11px] text-muted mt-1 flex items-center gap-2">
                      <span className="lcd px-1.5 tabular-nums" dir="ltr">{e.bpm} → {e.target}</span>
                      {it ? <span>שיא <bdi dir="ltr">{it.best}%</bdi>{it.bestBpm ? <>, עד <bdi dir="ltr">{it.bestBpm}</bdi> BPM</> : null}</span> : <span>עוד לא תרגלתם</span>}
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary !min-h-11 text-sm shrink-0" onClick={() => onPractice(e.id)} aria-label={`לתרגל ${e.name}`}><Icon name="play" size={14} />לתרגל</button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted">בציר הזמן: <span className="hand-R font-bold">R</span> = יד ימין, <span className="hand-L font-bold">L</span> = יד שמאל; אות קטנה = מכה שקטה. על הסט הטבעת הוורודה = ימין והתכולה = שמאל.</p>
    </>
  );
}

// שבעת הימים האחרונים (מהישן לחדש): האם תרגלתם
function lastWeek(days, today) {
  const out = [];
  let k = today;
  for (let i = 0; i < 7; i++) {
    out.unshift({ key: k, on: (days[k] || 0) > 0 });
    k = prevDay(k);
  }
  return out;
}

function Progress({ progress, onPractice, onLearnSong }) {
  const today = dayKey();
  const streak = streakOf(progress.days, today);
  const minutes = totalMinutes(progress);
  const stars = totalStars(progress);
  const next = suggestNext(progress, EXERCISES);
  const nextEx = next && EXERCISES.find((e) => e.id === next.id);
  // שירים שיש להם תרגול: { id, title, sections: [{ name, stars, best }] }
  const songs = useMemo(() => {
    const byId = {};
    for (const [key, it] of Object.entries(progress.items)) {
      const m = /^song:([^:]+):(.+)$/.exec(key);
      if (!m) continue;
      (byId[m[1]] ||= []).push({ sec: m[2], ...it });
    }
    return Object.entries(byId)
      .map(([id, list]) => {
        const song = songById(id);
        const groove = grooveFor(id);
        if (!song || !groove) return null;
        return { id, title: song.title, sections: list.map((x) => ({ name: groove.sections.find((s) => s.id === x.sec)?.name || x.sec, stars: x.stars, best: x.best })) };
      })
      .filter(Boolean);
  }, [progress]);
  const exDone = EXERCISES.filter((e) => progress.items[exerciseKey(e.id)]).length;
  const empty = stars === 0 && minutes === 0 && streak === 0 && songs.length === 0 && exDone === 0;

  return (
    <>
      <section className="grid grid-cols-3 gap-3" aria-label="סיכום">
        <Tile icon="flame" label="ימים ברצף" value={streak} note={streak > 0 ? 'כל יום תרגול מוסיף' : 'תרגלו היום כדי להתחיל'} />
        <Tile icon="clock" label="דקות תרגול" value={minutes} note="בסך הכול" />
        <Tile icon="star" label="כוכבים" value={stars} note={`${exDone} מתוך ${EXERCISES.length} תרגילים`} />
      </section>
      <section className="case px-3 py-3" aria-label="השבוע">
        <p className="text-xs font-bold mb-2">השבוע האחרון</p>
        <div className="flex gap-1.5" dir="ltr">
          {lastWeek(progress.days, today).map((d) => (
            <span key={d.key} className={`lcd flex-1 text-center text-[11px] py-1.5 tabular-nums ${d.on ? '' : '!text-[#4a4130]'}`} data-on={d.on} title={d.key}>
              {d.on ? '●' : '○'}
            </span>
          ))}
        </div>
      </section>
      {nextEx ? (
        <section className="case px-3 py-3 flex items-center gap-3" aria-label="ההצעה הבאה">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted">ההצעה הבאה</p>
            <p className="font-bold flex items-center gap-2 flex-wrap">{nextEx.name}<Stars n={next.stars} /></p>
            <p className="text-xs text-muted">{next.reason === 'new' ? 'תרגיל חדש במסלול.' : next.reason === 'again' ? 'עוד סיבוב כדי להגיע לשני כוכבים.' : 'שיפור אחרון – שלושה כוכבים.'}</p>
          </div>
          <button type="button" className="btn btn-primary !min-h-11 text-sm shrink-0" onClick={() => onPractice(nextEx.id)}><Icon name="play" size={14} />לתרגל</button>
        </section>
      ) : (
        <p className="case px-3 py-3 text-sm">כל התרגילים בשלושה כוכבים. אפשר להעלות את הקצב או לחזור לשירים.</p>
      )}
      {songs.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="שירים">
          <h2 className="poster text-4xl">שירים</h2>
          <ul className="case flex flex-col divide-y divide-line">
            {songs.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate"><bdi dir="ltr">{s.title}</bdi></p>
                  <p className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {s.sections.map((x) => <span key={x.name} className="flex items-center gap-1">{x.name}<Stars n={x.stars} size={12} /></span>)}
                  </p>
                </div>
                <button type="button" className="btn !min-h-11 text-sm shrink-0" onClick={() => onLearnSong(s.id)} aria-label={`ללמוד את ${s.title}`}><Icon name="cap" size={16} />ללמוד</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {empty && <p className="text-sm text-muted">עוד לא תרגלתם. בחרו תרגיל בלשונית "טכניקה" או שיר ב"ללמוד", וכאן יופיעו כוכבים, רצף ודקות.</p>}
      <p className="text-xs text-muted">כוכב ראשון מ-<bdi dir="ltr">{STAR_RULES[0]}%</bdi>, שני מ-<bdi dir="ltr">{STAR_RULES[1]}%</bdi>, שלישי מ-<bdi dir="ltr">{STAR_RULES[2]}%</bdi> – ושלישי רק במהירות מלאה (100%). רצף = ימים ברצף עם תרגול (הדגמה לא נספרת).</p>
    </>
  );
}

function Tile({ icon, label, value, note }) {
  return (
    <div className="case px-3 py-3 flex flex-col items-center text-center gap-1">
      <Icon name={icon} size={22} className="text-accent" />
      <span className="lcd px-3 py-1 text-3xl font-extrabold tabular-nums" dir="ltr" data-testid={`tile-${icon}`}>{value}</span>
      <span className="text-xs font-bold">{label}</span>
      <span className="text-[11px] text-muted leading-tight hidden sm:block">{note}</span>
    </div>
  );
}
