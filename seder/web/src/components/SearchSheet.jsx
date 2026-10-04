import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../App';
import { search, sortTasks } from '../lib/store';
import { TaskList } from './TaskItem';
import { Empty, Sheet } from './ui';

// חיפוש בכל מקום: כותרות, הערות וקישורים ("איפה שמרתי את ההרצאה ההיא?")
export default function SearchSheet({ onClose }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const results = sortTasks(search(state.tasks, q));
  return (
    <Sheet title="חיפוש" onClose={onClose}>
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:border-violet-500">
        <Search size={18} className="text-stone-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="מה מחפשים?" className="flex-1 py-2.5 outline-none" />
      </div>
      <div className="mt-3 pb-4">
        {q.trim() && (results.length ? <TaskList tasks={results} /> : <Empty>לא נמצא כלום</Empty>)}
      </div>
    </Sheet>
  );
}
