import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button, ErrorBox } from './ui';
import { canvasToDataUrl, fileToDataUrl } from '../lib/image';

function cameraErrorText(err) {
  if (!window.isSecureContext) return 'המצלמה עובדת רק בכתובת מאובטחת (https).';
  if (!navigator.mediaDevices?.getUserMedia) return 'הדפדפן הזה לא תומך במצלמה מתוך האפליקציה.';
  if (err?.name === 'NotAllowedError') return 'אין הרשאה למצלמה. אפשר לאשר אותה בהגדרות האתר בדפדפן.';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'לא נמצאה מצלמה במכשיר.';
  if (err?.name === 'NotReadableError') return 'המצלמה תפוסה על ידי אפליקציה אחרת.';
  return 'לא הצלחתי להפעיל את המצלמה.';
}

// צילום מתוך האפליקציה (עם בקשת הרשאה למצלמה). רק אם זה לא אפשרי - העלאה מהגלריה.
export default function CameraCapture({ onCapture, hint }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | live | failed
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStatus('starting');
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) throw new Error('no video element');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('live');
      } catch (err) {
        if (!cancelled) {
          setError(cameraErrorText(err));
          setStatus('failed');
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const dataUrl = canvasToDataUrl(video, video.videoWidth, video.videoHeight);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onCapture(await fileToDataUrl(file));
    } catch (err) {
      setError(err.message);
    }
  };

  if (status === 'failed') {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-2 py-4 text-slate-500">
          <CameraOff size={36} />
          <ErrorBox>{error}</ErrorBox>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => {
            setStatus('starting');
            setAttempt((a) => a + 1);
          }}>
          <RefreshCw size={18} /> נסה שוב להפעיל מצלמה
        </Button>
        <label className="block">
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          <span className="px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 cursor-pointer">
            <ImageIcon size={18} /> העלאת תמונה מהגלריה
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">מפעיל מצלמה...</div>
        )}
        {hint && status === 'live' && (
          <div className="absolute top-3 inset-x-3 text-center text-white text-xs bg-black/40 rounded-lg py-1">{hint}</div>
        )}
      </div>
      <Button onClick={capture} disabled={status !== 'live'} className="w-full h-14 text-lg">
        <Camera size={22} /> צלם
      </Button>
    </div>
  );
}
