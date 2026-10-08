import { useEffect, useState } from 'react';
import { codeFrom } from './lib/game';
import { loadProfile, saveProfile } from './lib/profile';
import Game from './components/Game';
import Home from './components/Home';
import ProfileForm from './components/ProfileForm';
import { ThemeButton } from './components/ui';

// הקוד של המשחק נשמר בכתובת (?g=ABCDE) – כך הקישור שנשלח לחברים מכניס ישר למשחק
function codeInUrl() {
  return codeFrom(location.search);
}

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState(codeInUrl);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const url = code ? `${location.pathname}?g=${code}` : location.pathname;
    if (`${location.pathname}${location.search}` !== url) history.replaceState(null, '', url);
  }, [code]);

  if (!profile.name || editing) {
    return (
      <ProfileForm
        profile={profile}
        invited={!profile.name && !!code}
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

  return (
    <div className="pb-10">
      <div className="mx-auto flex max-w-md justify-end px-4 pt-3">
        <ThemeButton />
      </div>
      <Home profile={profile} onOpen={setCode} onEditProfile={() => setEditing(true)} />
    </div>
  );
}
