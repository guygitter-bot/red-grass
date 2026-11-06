import { useCallback, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import Tile from '../components/Tile.jsx';
import TrashBar from '../components/TrashBar.jsx';
import Viewer from '../components/Viewer.jsx';
import { bytes, count, date } from '../lib/format.js';

const PAGE_GROUPS = 25;
const PAGE_TILES = 120;

// מסך סימון ומחיקה. groups – קבוצות (כפולות/דומות), או ids – רשימה רגילה (מטושטשות, נושא, מקור...)
// preselect – האם לסמן מראש למחיקה (בהצעות ניקוי כן, בנושא/מקור לא)
export default function Review({ title, desc, groups, ids, preselect, byId, onTrash, onKeep }) {
  const allIds = useMemo(() => (groups ? groups.flatMap((g) => g.ids) : ids), [groups, ids]);
  const [selected, setSelected] = useState(() => {
    if (!preselect) return new Set();
    return new Set(groups ? groups.flatMap((g) => g.ids.slice(1)) : ids);
  });
  const [limit, setLimit] = useState(groups ? PAGE_GROUPS : PAGE_TILES);
  const [view, setView] = useState(-1);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback((id) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const setMany = (list, on) => {
    setSelected((s) => {
      const n = new Set(s);
      for (const id of list) on ? n.add(id) : n.delete(id);
      return n;
    });
  };

  const live = allIds.filter((id) => byId[id]);
  const chosen = live.filter((id) => selected.has(id));
  const size = chosen.reduce((s, id) => s + (byId[id]?.size || 0), 0);
  const moveView = useCallback((d) => setView((v) => Math.max(0, Math.min(live.length - 1, v + d))), [live.length]);
  const closeView = useCallback(() => setView(-1), []);

  const doTrash = async () => {
    setBusy(true);
    try {
      // בהצעת ניקוי – מה שלא סומן נשאר ולא יוצע שוב
      const keep = preselect ? live.filter((id) => !selected.has(id)) : [];
      const ok = await onTrash(chosen, keep);
      if (ok) setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const visibleGroups = groups ? groups.filter((g) => g.ids.filter((id) => byId[id]).length >= 2) : null;

  return (
    <div className="pb-28">
      <Header title={title} back="#/">
        {!groups && live.length > 0 && (
          <button
            type="button"
            onClick={() => setMany(live, chosen.length < live.length)}
            className="px-3 h-9 rounded-full bg-card border border-line text-sm shrink-0"
          >
            {chosen.length < live.length ? 'לסמן הכול' : 'לבטל סימון'}
          </button>
        )}
      </Header>
      <main className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">
        {desc && <p className="text-muted text-sm">{desc}</p>}
        {!live.length && <p className="text-center text-muted py-16">אין כאן תמונות 🎉</p>}

        {visibleGroups &&
          visibleGroups.slice(0, limit).map((g) => {
            const gids = g.ids.filter((id) => byId[id]);
            const sel = gids.filter((id) => selected.has(id));
            return (
              <section key={g.ids[0]} className="bg-card border border-line rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {date(g.date)} · {count(gids.length)} תמונות
                    {sel.length > 0 && (
                      <span className="text-muted"> · מוחקים {count(sel.length)} ({bytes(sel.reduce((s, id) => s + (byId[id]?.size || 0), 0))})</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMany(gids, false);
                      onKeep(gids);
                    }}
                    className="px-3 py-1.5 rounded-full bg-soft text-xs font-semibold"
                  >
                    להשאיר את כולן
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {gids.map((id, i) => (
                    <Tile key={id} id={id} best={i === 0} selected={selected.has(id)} onToggle={toggle} onView={(x) => setView(live.indexOf(x))} />
                  ))}
                </div>
              </section>
            );
          })}

        {!groups && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {live.slice(0, limit).map((id) => (
              <Tile key={id} id={id} selected={selected.has(id)} onToggle={toggle} onView={(x) => setView(live.indexOf(x))} />
            ))}
          </div>
        )}

        {(groups ? visibleGroups.length : live.length) > limit && (
          <button type="button" onClick={() => setLimit((l) => l * 2)} className="py-3 rounded-xl bg-card border border-line font-semibold">
            להציג עוד
          </button>
        )}
      </main>

      <TrashBar n={chosen.length} size={size} busy={busy} onTrash={doTrash} />

      {view >= 0 && (
        <Viewer
          ids={live}
          index={view}
          photo={byId[live[view]]}
          selected={selected.has(live[view])}
          onToggle={toggle}
          onMove={moveView}
          onClose={closeView}
        />
      )}
    </div>
  );
}
