import { useRef, useState } from 'react';

// השוואת לפני / אחרי: גוררים את הקו ימינה ושמאלה. צד שמאל = לפני, צד ימין = אחרי.
export default function Compare({ before, after, ratio }) {
  const box = useRef(null);
  const [pos, setPos] = useState(50);

  function move(e) {
    const r = box.current?.getBoundingClientRect();
    if (!r?.width) return;
    setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  }

  return (
    <div
      ref={box}
      dir="ltr"
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl bg-soft"
      style={{ aspectRatio: ratio }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') move(e); }}
    >
      <img src={after} alt="אחרי" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <img src={before} alt="לפני" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">לפני</span>
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">אחרי</span>
      <div className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg text-black shadow">⇆</span>
      </div>
      <input
        type="range" min="0" max="100" value={Math.round(pos)} aria-label="כמה מהתמונה שלפני להציג"
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-x-0 bottom-0 h-6 w-full opacity-0"
      />
    </div>
  );
}
