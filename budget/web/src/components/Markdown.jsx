// תצוגה פשוטה של תשובת ה-AI: כותרות (##), רשימות (- / 1.), הדגשה (**) ופסקאות
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part));
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ h: h[1] });
    } else if (li) {
      if (!list) list = { items: [] };
      list.items.push(li[1]);
    } else {
      flush();
      blocks.push({ p: line });
    }
  }
  flush();
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, i) =>
        b.h ? (
          <h3 key={i} className="pt-2 text-base font-bold">
            {inline(b.h.replace(/\*\*/g, ''))}
          </h3>
        ) : b.items ? (
          <ul key={i} className="list-disc space-y-1 pr-5">
            {b.items.map((x, j) => (
              <li key={j}>{inline(x)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.p)}</p>
        ),
      )}
    </div>
  );
}
