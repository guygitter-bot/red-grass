import { useEffect, useRef, useState } from 'react';
import { cachedThumb, thumb } from '../lib/source.js';

// תמונה מוקטנת שנטענת רק כשהיא מגיעה למסך
export default function Thumb({ id, size = 300, className = '', fit = 'cover' }) {
  const [src, setSrc] = useState(() => cachedThumb(id, size));
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    setSrc(cachedThumb(id, size));
    const el = ref.current;
    if (!el || cachedThumb(id, size)) return () => {};
    const load = () => {
      thumb(id, size).then((s) => {
        if (alive) setSrc(s);
      });
    };
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        alive = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [id, size]);

  return (
    <div ref={ref} className={`bg-soft overflow-hidden ${className}`}>
      {src && <img src={src} alt="" draggable={false} className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`} />}
    </div>
  );
}
