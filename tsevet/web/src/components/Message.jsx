// הודעה אחת בשיחה: של הבעלים, של בוט, או של המערכת
import { memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText, plainText } from '../lib/copy';
import { findAgent } from '../lib/agents';
import { clock } from '../lib/format';
import Avatar from './Avatar';
import Markdown from './Markdown';
import { FileView, RenderCard } from './Files';
import { GenCard } from './Gen';
import { DevCard } from './DevCard';
import { ImageCard } from './ImageCard';
import { SiteCard } from './SiteCard';
import { PostCard } from './PostCard';
import { SkillCard } from './SkillCard';

function Body({ m }) {
  return (
    <>
      {m.text && <Markdown text={m.text} />}
      {m.photo && !m.files?.length && <span className="text-sm text-muted">📷 תמונה</span>}
      {m.files?.length > 0 && (
        <div className={`${m.text ? 'mt-2' : ''} space-y-2`}>
          {m.files.map((f) => (
            <FileView key={f.id} file={f} />
          ))}
        </div>
      )}
      {m.renders?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.renders.map((r) => (
            <RenderCard key={r.id} render={r} />
          ))}
        </div>
      )}
      {m.skills?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.skills.map((s) => (
            <SkillCard key={s.name} skill={s} />
          ))}
        </div>
      )}
      {m.images?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.images.map((g) => (
            <ImageCard key={g.id} image={g} />
          ))}
        </div>
      )}
      {m.posts?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.posts.map((x) => (
            <PostCard key={x.id} post={x} />
          ))}
        </div>
      )}
      {m.sites?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.sites.map((x) => (
            <SiteCard key={x.id} site={x} />
          ))}
        </div>
      )}
      {m.devs?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.devs.map((d) => (
            <DevCard key={d.id} dev={d} />
          ))}
        </div>
      )}
      {m.gens?.length > 0 && (
        <div className="mt-2 space-y-2">
          {m.gens.map((g) => (
            <GenCard key={g.id} gen={g} />
          ))}
        </div>
      )}
    </>
  );
}

function MessageBase({ m, agents }) {
  if (m.who === 'system')
    return <div className="mx-auto max-w-[90%] px-2 py-1 text-center text-xs text-muted">{m.text}</div>;

  if (m.who === 'owner')
    return (
      <div className="flex max-w-[88%] flex-col items-start self-start lg:max-w-[70%]">
        <div className="rounded-2xl rounded-ss-md bg-accent px-3.5 py-2.5 text-white [&_a]:text-white">
          <Body m={m} />
        </div>
        <span className="mt-0.5 px-1 text-[11px] text-muted">{clock(m.at)}</span>
      </div>
    );

  const agent = findAgent(agents, m.who) || { key: m.who, name: m.who, emoji: '🤖' };
  const to = m.handoff && findAgent(agents, m.handoff.to);
  return (
    <div className="flex max-w-[92%] items-start gap-2 self-end lg:max-w-[75%]">
      <Avatar agent={agent} agents={agents} size={34} />
      <div className="min-w-0">
        <div className="mb-0.5 px-1 text-xs font-bold text-muted">
          {agent.name}
          {m.step && <span className="ms-1.5 rounded-full bg-soft px-2 py-0.5 font-medium text-accent-ink">שלב {m.step.n} מתוך {m.step.of}</span>}
        </div>
        <div className="rounded-2xl rounded-ss-md border border-line bg-card px-3.5 py-2.5">
          <Body m={m} />
        </div>
        {m.plan?.length > 0 && (
          <div className="mt-1 rounded-2xl border border-line bg-soft px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-bold text-accent-ink">📋 התוכנית</div>
            <ol className="space-y-1">
              {m.plan.map((s, n) => {
                const who = findAgent(agents, s.to);
                return (
                  <li key={n} className="flex gap-1.5">
                    <span className="num shrink-0 text-muted">{n + 1}.</span>
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{who ? `${who.emoji} ${who.name}` : s.to}:</span> {s.request}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {m.handoff && (
          <div className="mt-1 inline-block rounded-full bg-soft px-3 py-1 text-xs text-accent-ink">
            ↪️ ל{to ? `${to.emoji} ${to.name}` : m.handoff.to}: {m.handoff.request}
          </div>
        )}
        <div className="flex items-center gap-2 px-1 text-[11px] text-muted">
          <span>{clock(m.at)}</span>
          {m.text && <CopyButton text={m.text} />}
        </div>
      </div>
    </div>
  );
}

// העתקת התשובה (בלי סימני העיצוב – טקסט נקי להדבקה בוואטסאפ, במייל וכו')
function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    if (await copyText(plainText(text))) {
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    }
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-soft hover:text-ink" aria-label="העתקת התשובה">
      {done ? <Check size={12} /> : <Copy size={12} />}
      {done ? 'הועתק' : 'העתקה'}
    </button>
  );
}

// memo: אותה הודעה = בלי ציור מחדש (כדי שסרטון מתנגן לא יופסק)
export default memo(MessageBase);
