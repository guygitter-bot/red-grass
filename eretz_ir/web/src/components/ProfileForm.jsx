import { useRef, useState } from 'react';
import { shrinkPhoto } from '../lib/profile';
import { Avatar, Button, Card } from './ui';

// שם ותמונה – בפעם הראשונה, או מהכפתור "עריכת פרופיל"
export default function ProfileForm({ profile, invited, onSave, onCancel }) {
  const [name, setName] = useState(profile.name || '');
  const [photo, setPhoto] = useState(profile.photo || '');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await shrinkPhoto(file));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!clean) return setError('מה השם?');
    onSave({ ...profile, name: clean, photo });
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-accent-ink">ארץ עיר</h1>
        <p className="mt-1 text-muted">{invited ? 'הזמינו אותך למשחק! קודם – איך יקראו לך?' : 'איך יקראו לך במשחק?'}</p>
      </div>
      <Card className="flex flex-col items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="בחירת תמונה">
          <Avatar player={{ id: profile.id, name: name || '?', photo }} size={112} />
          <span className="absolute -bottom-1 -left-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-card text-lg shadow">📷</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <div className="flex gap-2 text-sm">
          <button type="button" className="text-accent-ink underline" onClick={() => fileRef.current?.click()}>
            {photo ? 'החלפת תמונה' : 'הוספת תמונה'}
          </button>
          {photo && (
            <button type="button" className="text-muted underline" onClick={() => setPhoto('')}>
              בלי תמונה
            </button>
          )}
        </div>
        <label className="w-full">
          <span className="mb-1 block text-sm text-muted">שם</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus={!profile.name}
            placeholder="למשל: נועה"
            className="w-full rounded-2xl border border-line bg-page px-4 py-3 text-lg outline-none focus:border-accent"
          />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </Card>
      <Button type="submit" className="text-lg">
        {invited ? 'להצטרפות למשחק' : 'שמירה'}
      </Button>
      {onCancel && (
        <Button kind="ghost" onClick={onCancel}>
          ביטול
        </Button>
      )}
    </form>
  );
}
