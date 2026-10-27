// מיקרופון: פותח, מקשיב וסוגר. הודעות שגיאה בעברית.
export function micErrorMessage(err) {
  const name = err && err.name;
  if (name === 'unsupported') return 'הדפדפן הזה לא תומך במיקרופון. נסו דפדפן עדכני, ופתחו את האפליקציה בכתובת מאובטחת.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'אין הרשאה למיקרופון. אפשרו אותה בהגדרות הדפדפן (סמל המנעול ליד הכתובת) ונסו שוב.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'לא מצאנו מיקרופון במכשיר. חברו מיקרופון ונסו שוב.';
  if (name === 'NotReadableError') return 'המיקרופון תפוס על ידי אפליקציה אחרת. סגרו אותה ונסו שוב.';
  return 'לא הצלחנו להפעיל את המיקרופון. נסו שוב.';
}

/**
 * מתחיל להקשיב. onFrame(buffer, sampleRate) נקרא כ-20 פעמים בשנייה.
 * מחזיר { stop } – חובה לקרוא לו ביציאה מהמסך.
 */
export async function startMic(onFrame, { fftSize = 4096, intervalMs = 50 } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('unsupported');
    e.name = 'unsupported';
    throw e;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = fftSize;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    onFrame(buf, ctx.sampleRate);
  }, intervalMs);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // כבר נסגר
      }
      try {
        src.disconnect();
        ctx.close();
      } catch {
        // כבר נסגר
      }
    },
  };
}
