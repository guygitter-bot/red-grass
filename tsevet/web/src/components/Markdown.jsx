// מצייר את הבלוקים של lib/markdown.js (בלי HTML גולמי)
import { Fragment } from 'react';
import { parseMarkdown } from '../lib/markdown';

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    if (n.t === 'bold') return <strong key={i}>{n.text}</strong>;
    if (n.t === 'link')
      return (
        <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="break-all text-accent-ink underline" dir="ltr">
          {n.text}
        </a>
      );
    return <Fragment key={i}>{n.text}</Fragment>;
  });
}

export default function Markdown({ text }) {
  return (
    <div className="space-y-2 break-words">
      {parseMarkdown(text).map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-muted">•</span>
                <span className="min-w-0">
                  <Inline nodes={it} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline nodes={l} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
