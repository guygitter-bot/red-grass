import { useEffect, useState } from 'react';
import { codeFrom } from './lib/game';
import { clubFrom } from './lib/clubs';
import { ClubScreen } from './components/Clubs';
import { loadProfile, saveProfile } from './lib/profile';
import Game from './components/Game';
import Home from './components/Home';
import ProfileForm from './components/ProfileForm';
import { ThemeButton } from './components/ui';

// הקוד של המשחק נשמר בכתובת (?g=ABCDE) – כך הקישור שנשלח לחברים מכניס ישר למשחק.
// קישור לקהילה: ?c=ABCDEF
function codeInUrl() {
  return codeFrom(location.search);
}

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState(codeInUrl);
  const [club, setClub] = useState(() => (codeInUrl() ? '' : clubFrom(location.search)));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const url = code ? `${location.pathname}?g=${code}` : club ? `${location.pathname}?c=${club}` : location.pathname;
    if (`${location.pathname}${location.search}` !== url) history.replaceState(null, '', url);
  }, [code, club]);

  const openGame = (c) => {
    setClub('');
    setCode(c);
  };

  if (!profile.name || editing) {
    return (
      <ProfileForm
        profile={profile}
        invited={!profile.name && !!(code || club)}
        onCancel={profile.name ? () => setEditing(false) : null}
        onSave={(p) => {
          saveProfile(p);
          setProfile(p);
          setEditing(false);
        }}
      />
    );
  }

  if (code) return <Game key={code} code={code} profile={profile} onExit={() => setCode('')} onEditProfile={() => setEditing(true)} />;

  if (club) return <ClubScreen key={club} code={club} profile={profile} onExit={() => setClub('')} onOpenGame={openGame} />;

  return (
    <div className="pb-10">
      <div className="mx-auto flex max-w-md justify-end px-4 pt-3">
        <ThemeButton />
      </div>
      <Home profile={profile} onOpen={setCode} onOpenClub={setClub} onEditProfile={() => setEditing(true)} />
    </div>
  );
}
