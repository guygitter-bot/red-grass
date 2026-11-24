// שדות לעריכה במקום: נראים כטקסט רגיל, ונהפכים לשדה כשלוחצים. בהדפסה – טקסט נקי (ראו index.css)
import { useEffect, useRef } from 'react';

const base =
  'resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-ink placeholder:text-muted hover:border-line focus:border-turq focus:bg-card focus:outline-none focus:ring-2 focus:ring-turq/30';

// רוחב מלא כברירת מחדל, אלא אם נקבע רוחב אחר
const width = (cls) => (/(^|\s)w-/.test(cls) ? '' : 'w-full');

// גובה אוטומטי לפי התוכן (גם לפני הדפסה, כדי שלא ייחתך טקסט)
function useAutoHeight(value) {
  const ref = useRef(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    fit();
    window.addEventListener('beforeprint', fit);
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('beforeprint', fit);
      window.removeEventListener('resize', fit);
    };
  }, [value]);
  return ref;
}

export function EditText({ value, onChange, placeholder = 'לחצו לכתיבה', label, className = '' }) {
  const ref = useAutoHeight(value);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={label}
      className={`${base} ${width(className)} ${className}`}
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// רשימה: שורה לכל פריט (הפריטים הריקים נזרקים בשרת בשמירה)
export function EditLines({ value, onChange, placeholder = 'שורה לכל פריט', label, className = '' }) {
  return (
    <EditText
      label={label}
      className={className}
      placeholder={placeholder}
      value={(value || []).join('\n')}
      onChange={(t) => onChange(t.split('\n'))}
    />
  );
}

export function EditNum({ value, onChange, label, step = 0.5, className = '' }) {
  return (
    <input
      type="number"
      dir="ltr"
      inputMode="decimal"
      min="0"
      step={step}
      aria-label={label}
      className={`${base} num-edit ${width(className) && 'w-16'} text-center ${className}`}
      value={value ?? 0}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const v = Number(e.target.value);
        onChange(Number.isFinite(v) && v >= 0 ? v : 0);
      }}
    />
  );
}
