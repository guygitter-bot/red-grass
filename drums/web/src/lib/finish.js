// גימור (עטיפה) של התופים לכל סט – רק מראה: משפיע על צבעי המעטפת בבמה ובכרטיסי הסטים.
// הצבעים עצמם ב-index.css (`[data-finish='…']`). סט אישי יורש את הגימור של הסט שממנו נבנה.
const FINISH = {
  standard: 'midnight',
  bonham: 'emerald',
  ringo: 'pearl',
  peart: 'ruby',
  barker: 'chrome',
  grohl: 'teal',
  porcaro: 'ivory',
  chadsmith: 'violet',
  ulrich: 'piano',
};

export function finishOf(kit) {
  const id = kit && (kit.custom ? kit.baseId : kit.id);
  return FINISH[id] || 'midnight';
}
