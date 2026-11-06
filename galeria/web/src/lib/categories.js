// מיון לקטגוריות – רק בתוך הטלפון: לפי המקור (תיקייה/שם קובץ) ולפי מה ש-ML Kit זיהה בתמונה (תוויות באנגלית)

export const SOURCES = [
  { key: 'camera', label: 'מצלמה', icon: '📷' },
  { key: 'whatsapp', label: 'וואטסאפ', icon: '💬' },
  { key: 'screenshot', label: 'צילומי מסך', icon: '📱' },
  { key: 'download', label: 'הורדות', icon: '⬇️' },
  { key: 'social', label: 'רשתות חברתיות', icon: '🌐' },
  { key: 'other', label: 'תיקיות אחרות', icon: '🗂️' },
];

export const TOPICS = [
  { key: 'people', label: 'אנשים', icon: '🧑‍🤝‍🧑' },
  { key: 'food', label: 'אוכל', icon: '🍽️' },
  { key: 'pets', label: 'בעלי חיים', icon: '🐾' },
  { key: 'nature', label: 'טבע ונופים', icon: '🌳' },
  { key: 'docs', label: 'מסמכים וקבלות', icon: '📄' },
  { key: 'city', label: 'עיר ומבנים', icon: '🏙️' },
  { key: 'cars', label: 'רכבים', icon: '🚗' },
  { key: 'events', label: 'אירועים', icon: '🎉' },
  { key: 'other', label: 'שונות', icon: '✨' },
];

export function sourceOf(photo) {
  const s = `${photo.bucket || ''} ${photo.path || ''} ${photo.name || ''}`.toLowerCase();
  if (/screenshot|screen_?shot|צילומי מסך|צילום מסך|screen recording|screencap/.test(s)) return 'screenshot';
  if (/whatsapp/.test(s)) return 'whatsapp';
  if (/telegram|instagram|facebook|messenger|tiktok|snapchat|twitter|pinterest/.test(s)) return 'social';
  if (/download|הורדות/.test(s)) return 'download';
  if (/dcim|camera|מצלמה|^img_|pxl_/.test(s) || /^(img|pxl|dsc)[_-]?\d/.test((photo.name || '').toLowerCase())) return 'camera';
  return 'other';
}

// תוויות של ML Kit (המודל הבסיסי) → נושא. המילה הראשונה שמתאימה (לפי ביטחון) קובעת
const TOPIC_WORDS = {
  docs: ['paper', 'receipt', 'poster', 'menu', 'document', 'text', 'handwriting', 'newspaper', 'screenshot', 'whiteboard', 'calendar', 'book'],
  food: ['food', 'dish', 'cuisine', 'cake', 'bread', 'pizza', 'fruit', 'vegetable', 'dessert', 'cookie', 'cupcake', 'pasta', 'salad', 'sushi', 'soup', 'meal', 'lunch', 'breakfast', 'dinner', 'baked goods', 'coffee', 'drink', 'wine', 'juice', 'tableware', 'cutlery', 'egg', 'sandwich', 'hamburger', 'hot dog', 'ice cream', 'chocolate', 'cheese', 'meat'],
  pets: ['dog', 'cat', 'bird', 'pet', 'horse', 'fish', 'animal', 'insect', 'butterfly', 'rabbit', 'cattle', 'sheep', 'duck', 'turtle', 'reptile', 'bear', 'hamster', 'whiskers', 'paw'],
  people: ['selfie', 'smile', 'person', 'face', 'beard', 'baby', 'child', 'girl', 'boy', 'hair', 'eyelash', 'skin', 'bride', 'groom', 'dance', 'crowd', 'team', 'tattoo', 'lipstick', 'cool', 'fun', 'jeans', 'sunglasses', 'hand'],
  events: ['party', 'wedding', 'concert', 'balloon', 'birthday', 'christmas', 'event', 'stage', 'fireworks', 'candle', 'flag'],
  cars: ['car', 'vehicle', 'bicycle', 'motorcycle', 'bus', 'truck', 'wheel', 'tire', 'train', 'airplane', 'boat'],
  nature: ['sky', 'mountain', 'beach', 'sea', 'lake', 'river', 'plant', 'flower', 'tree', 'forest', 'garden', 'sunset', 'cloud', 'grass', 'desert', 'snow', 'waterfall', 'leaf', 'petal', 'rock', 'field', 'park'],
  city: ['building', 'skyscraper', 'bridge', 'road', 'city', 'tower', 'church', 'mosque', 'temple', 'monument', 'room', 'house', 'stadium', 'shelf', 'interior design', 'kitchen', 'furniture'],
};

export function topicOf(photo, feat) {
  const labels = Array.isArray(feat?.labels) ? feat.labels : [];
  const sorted = [...labels].sort((a, b) => (b?.[1] || 0) - (a?.[1] || 0));
  for (const l of sorted) {
    const t = String(l?.[0] || '').toLowerCase();
    if (!t) continue;
    for (const [topic, words] of Object.entries(TOPIC_WORDS)) {
      if (words.some((w) => t === w || t.includes(w))) return topic;
    }
  }
  if (sourceOf(photo) === 'screenshot') return 'docs';
  return 'other';
}
