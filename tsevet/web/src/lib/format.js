// עיצוב קטן: זמן יחסי, כסף, גודל קובץ, משך

export function relTime(at, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  if (d === 1) return 'אתמול';
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

export function clock(at) {
  return new Date(at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

// שקלים: עד שקל – שתי ספרות אחרי הנקודה
export function ils(usd, rate) {
  const v = (usd || 0) * (rate || 0);
  return `₪${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('he-IL')}`;
}

export function usd(v) {
  return `$${(v || 0).toFixed(2)}`;
}

export function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// "01" -> יום בחודש, בפורמט "1 בנובמבר"
export function dayLabel(month, day) {
  const d = new Date(`${month}-${day}T12:00:00`);
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}
