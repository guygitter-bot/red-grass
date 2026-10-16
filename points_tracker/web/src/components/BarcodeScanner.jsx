import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Search } from 'lucide-react';
import { Button, ErrorBox, Input } from './ui';
import { cleanBarcode, detectBarcode, isBarcode } from '../lib/barcode';

// סריקת ברקוד: מצלמה חיה שמזהה לבד, או תמונה מהגלריה, או הקלדת המספר שמתחת לפסים.
export default function BarcodeScanner({ onCode }) {
  const videoRef = useRef(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let stream;
    let timer;
    let stopped = false;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setLive(true);
        // מנסים לזהות כמה פעמים בשנייה עד שנמצא ברקוד
        const scan = async () => {
          if (stopped) return;
          try {
            const code = videoRef.current?.videoWidth ? await detectBarcode(videoRef.current) : null;
            if (code && !stopped) {
              stopped = true;
              navigator.vibrate?.(80);
              onCode(code);
              return;
            }
          } catch {
            // פריים לא קריא - ממשיכים
          }
          timer = setTimeout(scan, 300);
        };
        scan();
      } catch {
        if (!stopped) setError('לא הצלחתי להפעיל את המצלמה. אפשר לבחור תמונה של הברקוד מהגלריה או להקליד את המספר.');
      }
    }
    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const code = await detectBarcode(bitmap);
      if (code) onCode(code);
      else setError('לא מצאתי ברקוד בתמונה. נסה/י תמונה חדה יותר, או הקלד/י את המספר.');
    } catch {
      setError('לא הצלחתי לקרוא את התמונה.');
    }
  };

  return (
    <div className="space-y-3">
      {!error && (
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500/80" />
          <div className="absolute top-3 inset-x-3 text-center text-white text-xs bg-black/40 rounded-lg py-1">
            {live ? 'כוון/י את הברקוד לקו האדום' : 'מפעיל מצלמה...'}
          </div>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
      <label className="block">
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        <span className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 cursor-pointer">
          <ImageIcon size={18} /> תמונה של הברקוד מהגלריה
        </span>
      </label>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          dir="ltr"
          placeholder="או הקלד/י את מספר הברקוד"
          value={typed}
          onChange={(e) => setTyped(cleanBarcode(e.target.value))}
        />
        <Button variant="secondary" className="px-4 py-2" disabled={!isBarcode(typed)} onClick={() => onCode(typed)} aria-label="חפש ברקוד">
          <Search size={18} />
        </Button>
      </div>
    </div>
  );
}
