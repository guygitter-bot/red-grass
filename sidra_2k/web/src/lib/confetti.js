// קונפטי בצבעי האלוף – ציור על canvas שנמחק בסוף
const COLORS = { LAL: ['#552583', '#fdb927', '#7a3cc0', '#ffffff'], SAS: ['#c4ced4', '#121418', '#8a969c', '#ffffff'] };

export function confetti(team) {
  if (!team || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.scale(dpr, dpr);
  const cols = COLORS[team];
  const ps = Array.from({ length: 180 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    r: Math.random() * 6.28,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 7,
    h: 8 + Math.random() * 10,
    c: cols[(Math.random() * cols.length) | 0],
  }));
  let t = 0;
  const frame = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
      ctx.restore();
    }
    if (++t < 260) requestAnimationFrame(frame);
    else cv.remove();
  };
  requestAnimationFrame(frame);
}
