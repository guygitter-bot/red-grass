// הסרט המלא: מנגן את השוטים אחד אחרי השני על canvas, עם כותרת פתיחה, מעברים רכים ושקופית סיום –
// ואותו ציור בדיוק מוקלט לקובץ אחד (MediaRecorder). החישובים פונקציות טהורות (עם בדיקות).
export const FADE = 0.45; // מעבר בין שוטים (שניות)
export const TITLE_FROM = 0.8;
export const TITLE_TO = 4.6;
export const OUTRO = 3.6; // שקופית הסיום: השניות האחרונות של השוט האחרון

export const frameSize = (aspect) => (aspect === '9:16' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 });

const clamp = (x) => Math.max(0, Math.min(1, x));

// כמה השוט חשוך (0 = רואים הכול, 1 = שחור): נכנס מחושך בהתחלה ויוצא לחושך בסוף
export function blackAt(t, duration, isLast) {
  const fadeIn = 1 - clamp(t / FADE);
  const out = isLast ? FADE * 2 : FADE;
  const fadeOut = clamp((t - (duration - out)) / out);
  return Math.max(fadeIn, fadeOut);
}

// שקיפות של שכבה שמופיעה בין from ל-to, עם כניסה ויציאה רכות
export function layerAlpha(t, from, to, fade = 0.6) {
  if (t <= from || t >= to) return 0;
  return clamp(Math.min((t - from) / fade, (to - t) / fade));
}

// שקיפות שקופית הסיום בשוט האחרון (נשארת עד הסוף)
export const outroAlpha = (t, duration) => clamp((t - (duration - OUTRO)) / 0.8);

// איפה לצייר וידאו (vw×vh) כך שימלא את המסגרת (cw×ch) בלי לעוות
export function coverRect(vw, vh, cw, ch) {
  if (!(vw > 0) || !(vh > 0)) return { x: 0, y: 0, w: cw, h: ch };
  const k = Math.max(cw / vw, ch / vh);
  const w = vw * k;
  const h = vh * k;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

// סוג הקובץ להקלטה: mp4 אם הדפדפן יודע (נפתח בכל מקום), אחרת webm
export function pickMime(isSupported) {
  const all = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return all.find((m) => isSupported(m)) || '';
}

// שוברים טקסט ארוך לשורות לפי רוחב (measure מחזיר רוחב בפיקסלים)
export function wrapLines(text, maxWidth, measure, maxLines = 3) {
  const lines = [];
  let line = '';
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

const FONT = 'system-ui, -apple-system, "Segoe UI", "Arial Hebrew", Arial, sans-serif';
const GOLD = '#e6cf9a';

function text(ctx, lines, x, y, size, weight, color, gap = 1.25) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * gap));
  return y + lines.length * size * gap;
}

// כותרת הפתיחה: שם הפרויקט, קו זהב, ומשפט מתחת
function drawTitle(ctx, w, h, alpha, { name, tagline }) {
  if (alpha <= 0 || !name) return;
  const u = Math.min(w, h) / 1080;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'rtl';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24 * u;
  const size = 96 * u;
  ctx.font = `600 ${size}px ${FONT}`;
  const names = wrapLines(name, w * 0.84, (s) => ctx.measureText(s).width, 2);
  let y = h * 0.8 - (names.length - 1) * size * 1.2;
  y = text(ctx, names, w / 2, y, size, 600, '#fff', 1.2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = GOLD;
  ctx.fillRect(w / 2 - 70 * u, y - size * 0.82, 140 * u, 3 * u);
  if (tagline) {
    ctx.font = `400 ${40 * u}px ${FONT}`;
    text(ctx, wrapLines(tagline, w * 0.8, (s) => ctx.measureText(s).width, 2), w / 2, y - size * 0.82 + 62 * u, 40 * u, 400, '#fff');
  }
  ctx.restore();
}

// שקופית הסיום: השוט מוחשך, ועליו שם הפרויקט ופרטי הקשר
function drawOutro(ctx, w, h, alpha, { name, contact }) {
  if (alpha <= 0 || (!name && !contact)) return;
  const u = Math.min(w, h) / 1080;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(8,10,16,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'rtl';
  let y = h * 0.47;
  if (name) {
    ctx.font = `600 ${88 * u}px ${FONT}`;
    const names = wrapLines(name, w * 0.84, (s) => ctx.measureText(s).width, 2);
    y = text(ctx, names, w / 2, y - (names.length - 1) * 88 * u * 0.6, 88 * u, 600, '#fff', 1.2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(w / 2 - 70 * u, y - 70 * u, 140 * u, 3 * u);
  }
  if (contact) {
    ctx.font = `500 ${46 * u}px ${FONT}`;
    text(ctx, wrapLines(contact, w * 0.84, (s) => ctx.measureText(s).width, 3), w / 2, y + 10 * u, 46 * u, 500, GOLD, 1.35);
  }
  ctx.restore();
}

// פריים אחד של הסרט: השוט, החשכה במעבר, והכותרות
export function drawFrame(ctx, w, h, video, t, duration, { first, last, titles }) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const r = coverRect(video.videoWidth, video.videoHeight, w, h);
  ctx.drawImage(video, r.x, r.y, r.w, r.h);
  if (first) drawTitle(ctx, w, h, layerAlpha(t, TITLE_FROM, Math.min(TITLE_TO, duration - FADE)), titles);
  if (last) drawOutro(ctx, w, h, outroAlpha(t, duration), titles);
  const black = blackAt(t, duration, last);
  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${black})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('הדפדפן הזה לא מצליח לנגן את הסרטון. נסו ב-Chrome או ב-Safari.'));
    v.src = url;
  });
}

// מנגן את הסרט על ה-canvas. record = גם מקליט לקובץ. מחזיר { done: Promise<Blob | null>, stop() }.
// clips: כתובות (blob:) של השוטים לפי הסדר. titles: { name, tagline, contact }. onProgress(0..1)
export function playFilm(canvas, clips, titles, { record = false, onProgress = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  let stopped = false;
  let current = null;
  let raf = 0;
  let audio = null;
  let recorder = null;
  const chunks = [];

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    current?.pause();
  };

  const playOne = (video, i, base, total) => new Promise((resolve, reject) => {
    current = video;
    const first = i === 0;
    const last = i === clips.length - 1;
    const duration = video.duration || 8;
    const tick = () => {
      if (stopped) return resolve();
      const t = video.currentTime;
      drawFrame(ctx, w, h, video, t, duration, { first, last, titles });
      // הקול מתעמעם יחד עם התמונה במעברים
      video.volume = Math.max(0, 1 - blackAt(t, duration, last));
      onProgress(Math.min(1, (base + t) / total));
      if (video.ended || t >= duration - 0.03) return resolve();
      raf = requestAnimationFrame(tick);
    };
    video.onerror = () => reject(new Error('הניגון נעצר. נסו שוב.'));
    video.play().then(() => { raf = requestAnimationFrame(tick); }, () => reject(new Error('הדפדפן חסם את הניגון. לחצו שוב.')));
  });

  const done = (async () => {
    const videos = [];
    try {
      for (const url of clips) videos.push(await loadVideo(url));
      const total = videos.reduce((sum, v) => sum + (v.duration || 8), 0);
      if (record) {
        const mime = pickMime((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
        if (!mime || !canvas.captureStream) throw new Error('הדפדפן הזה לא יודע להקליט סרט מלא. אפשר להוריד כל שוט בנפרד, או לנסות ב-Chrome.');
        const stream = canvas.captureStream(30);
        // הקול של השוטים נכנס להקלטה (ונשמע גם ברמקול)
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          audio = new AC();
          const out = audio.createMediaStreamDestination();
          for (const v of videos) {
            const src = audio.createMediaElementSource(v);
            src.connect(out);
            src.connect(audio.destination);
          }
          out.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
        }
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
        recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
        recorder.start(1000);
      }
      let base = 0;
      for (let i = 0; i < videos.length && !stopped; i++) {
        await playOne(videos[i], i, base, total);
        base += videos[i].duration || 8;
      }
      if (!recorder) return null;
      const blob = await new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType.split(';')[0] }));
        recorder.stop();
      });
      return stopped || !blob.size ? null : blob;
    } finally {
      cancelAnimationFrame(raf);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      videos.forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
      audio?.close().catch(() => {});
    }
  })();

  return { done, stop };
}
