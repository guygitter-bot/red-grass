import { useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import SongPlayer from './components/SongPlayer';
import { KITS, kitById } from './data/kits';
import { songsForKit } from './data/songs';
import { safeVoice } from './lib/kit';
import { getSamplesStatus, onSamplesStatus, preloadSamples, setMasterVolume } from './lib/sounds';
import { addSong, loadActiveId, loadKits, loadSongs, loadVolumes, saveActiveId, saveKits, saveSongs, saveVolumes } from './lib/storage';
import BuilderScreen from './screens/BuilderScreen';
import KitsScreen from './screens/KitsScreen';
import PlayScreen from './screens/PlayScreen';
import SongScreen from './screens/SongScreen';

// סט מפורסם ← צורה אחידה עם הקול המלא
function resolveFamous(k) {
  return { ...k, voice: safeVoice(k.voice) };
}

export default function App() {
  const [screen, setScreen] = useState('play');
  const [custom, setCustom] = useState(loadKits);
  const [activeId, setActiveId] = useState(() => loadActiveId() || KITS[0].id);
  const [vol, setVol] = useState(loadVolumes);
  const [songs, setSongs] = useState(loadSongs);
  const [songId, setSongId] = useState(null);
  const [builderBase, setBuilderBase] = useState(null);
  const [builderKey, setBuilderKey] = useState(0);
  const [samples, setSamples] = useState(getSamplesStatus);
  // מצב לימוד: מזהה השיר שלומדים (או null) + גישה לנגן השיר (זמן וקצב) לסנכרון
  const [lessonId, setLessonId] = useState(null);
  const songApi = useRef(null);

  const active = custom.find((k) => k.id === activeId) || (kitById(activeId) && resolveFamous(kitById(activeId))) || resolveFamous(KITS[0]);

  // שירי הסט הפעיל: של הסט המפורסם עצמו, או של הסט המפורסם שממנו נבנה סט אישי
  const kitSongs = songsForKit(active.custom ? active.baseId : active.id);

  // טעינת הצלילים האמיתיים ברקע כבר בפתיחה (אפשר לנגן מיד – עד שהם מוכנים עובד צליל גיבוי)
  useEffect(() => {
    const off = onSamplesStatus(setSamples);
    preloadSamples();
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    setMasterVolume(vol.drums);
    saveVolumes(vol);
  }, [vol]);

  const pick = (id) => {
    setActiveId(id);
    saveActiveId(id);
    setScreen('play');
  };

  // שיר מרשימת הסט: בוחר את הסט, טוען את השיר (נכנס לשירים האחרונים) ועובר לנגינה
  const pickWithSong = (kitId, videoId) => {
    setActiveId(kitId);
    saveActiveId(kitId);
    loadSong(videoId);
    setScreen('play');
  };

  // 🎓 ללמוד שיר מרשימת הסט: בוחר את הסט (בלי לטעון את הווידאו – הוא יטען כשבוחרים "עם השיר")
  const learnSong = (kitId, videoId) => {
    setActiveId(kitId);
    saveActiveId(kitId);
    setLessonId(videoId);
    setScreen('play');
  };

  const build = (base) => {
    setBuilderBase(base);
    setBuilderKey((k) => k + 1);
    setScreen('builder');
  };

  const saveCustom = (kit) => {
    const next = custom.some((k) => k.id === kit.id) ? custom.map((k) => (k.id === kit.id ? kit : k)) : [...custom, kit];
    setCustom(next);
    saveKits(next);
    pick(kit.id);
  };

  const remove = (kit) => {
    if (!window.confirm(`למחוק את "${kit.name}"?`)) return;
    const next = custom.filter((k) => k.id !== kit.id);
    setCustom(next);
    saveKits(next);
    if (activeId === kit.id) {
      setActiveId(KITS[0].id);
      saveActiveId(KITS[0].id);
    }
  };

  const loadSong = (id) => {
    setSongId(id);
    setSongs((s) => {
      const n = addSong(s, id);
      saveSongs(n);
      return n;
    });
  };

  const setTitle = (title) => {
    if (!songId) return;
    setSongs((s) => {
      const n = addSong(s, songId, title);
      saveSongs(n);
      return n;
    });
  };

  return (
    <div className="h-dvh flex flex-col-reverse lg:flex-row short:flex-row bg-page text-ink">
      <Nav screen={screen} onGo={setScreen} />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col relative">
        {samples === 'loading' && (
          <div className="absolute top-2 start-2 z-10 rounded-full bg-card/90 px-3 py-1 text-xs text-muted pointer-events-none" role="status">
            טוען צלילים…
          </div>
        )}
        {songId && (
          <SongPlayer
            videoId={songId}
            hidden={screen !== 'play' && screen !== 'song'}
            songVol={vol.song}
            drumVol={vol.drums}
            onSongVol={(v) => setVol((o) => ({ ...o, song: v }))}
            onDrumVol={(v) => setVol((o) => ({ ...o, drums: v }))}
            onTitle={setTitle}
            onClose={() => setSongId(null)}
            apiRef={songApi}
          />
        )}
        {screen === 'play' && (
          <PlayScreen kit={active} drumVol={vol.drums} onDrumVol={(v) => setVol((o) => ({ ...o, drums: v }))} onPickKit={() => setScreen('kits')} songs={kitSongs} currentSong={songId} onLoadSong={loadSong} lessonId={lessonId} onLesson={setLessonId} songApi={songApi} />
        )}
        {screen === 'kits' && <KitsScreen activeId={activeId} custom={custom} onPick={pick} onPickSong={pickWithSong} onLearnSong={learnSong} onBuild={build} onDelete={remove} />}
        {screen === 'builder' && <BuilderScreen key={builderKey} base={builderBase} onSave={saveCustom} />}
        {screen === 'song' && <SongScreen current={songId} recent={songs} onLoad={loadSong} onGoPlay={() => setScreen('play')} />}
      </main>
    </div>
  );
}
