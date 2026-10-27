import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isNative } from '../lib/native';

// באפליקציה מ-Google Play: כשיש גרסה חדשה בחנות (אחרי שגוגל אישרו) מופיע פס "יש גרסה חדשה".
// "עדכון" מוריד את העדכון בתוך האפליקציה (In-App Updates של גוגל), ואם אי אפשר – פותח את הדף בחנות.
// סגירה – עד הפתיחה הבאה של האפליקציה
export default function UpdateBanner() {
  const [plugin, setPlugin] = useState(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!isNative()) return undefined;
    let alive = true;
    import('@capacitor/core')
      .then(async ({ registerPlugin }) => {
        const appUpdate = registerPlugin('AppUpdate');
        const info = await appUpdate.getAppUpdateInfo();
        // 2 = UPDATE_AVAILABLE
        if (alive && info?.updateAvailability === 2) setPlugin({ appUpdate, immediate: Boolean(info.immediateUpdateAllowed) });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!plugin || closed) return null;
  const update = async () => {
    try {
      if (plugin.immediate) await plugin.appUpdate.performImmediateUpdate();
      else await plugin.appUpdate.openAppStore();
    } catch {
      plugin.appUpdate.openAppStore().catch(() => {});
    }
  };
  return (
    <div className="mb-3 rounded-2xl bg-white text-stone-800 shadow-sm px-3 py-2 flex items-center gap-2">
      <span className="flex-1 text-sm font-medium">יש גרסה חדשה של mat-kon 🎉</span>
      <button onClick={update} className="rounded-xl bg-orange-500 text-white text-sm font-bold px-3 py-1.5 flex items-center gap-1">
        <Download size={15} /> עדכון
      </button>
      <button onClick={() => setClosed(true)} className="p-1 text-stone-400" aria-label="סגירה">
        <X size={18} />
      </button>
    </div>
  );
}
