// סגנונות מוכנים לטקסט ולכתוביות. אותם ערכים משמשים את התצוגה בדפדפן ואת הייצוא.

export const TEXT_PRESETS = [
  { id: 'title', he: 'כותרת', en: 'Title', style: { font: 'Heebo', size: 9, color: '#ffffff', outline: 0, shadow: true, box: false, anim: 'pop', y: 0.2 } },
  { id: 'outline', he: 'מודגש', en: 'Bold outline', style: { font: 'Rubik', size: 8, color: '#ffffff', outline: 9, outlineColor: '#000000', shadow: false, box: false, anim: 'pop', y: 0.25 } },
  { id: 'yellow', he: 'צהוב בולט', en: 'Punchy yellow', style: { font: 'Secular One', size: 8, color: '#ffd400', outline: 10, outlineColor: '#000000', shadow: false, box: false, anim: 'slide', y: 0.25 } },
  { id: 'box-dark', he: 'קופסה כהה', en: 'Dark box', style: { font: 'Heebo', size: 5.5, color: '#ffffff', outline: 0, shadow: false, box: true, boxColor: '#000000', boxOpacity: 0.75, anim: 'fade', y: 0.3 } },
  { id: 'box-light', he: 'קופסה בהירה', en: 'Light box', style: { font: 'Assistant', size: 5.5, color: '#111111', outline: 0, shadow: false, box: true, boxColor: '#ffffff', boxOpacity: 0.94, anim: 'fade', y: 0.3 } },
  { id: 'label', he: 'תווית אדומה', en: 'Red label', style: { font: 'Rubik', size: 5, color: '#ffffff', outline: 0, shadow: false, box: true, boxColor: '#e11d48', boxOpacity: 1, anim: 'slide', y: 0.15 } },
  { id: 'lower', he: 'כותרת תחתונה', en: 'Lower third', style: { font: 'Alef', size: 4.5, color: '#ffffff', outline: 0, shadow: false, box: true, boxColor: '#2563eb', boxOpacity: 1, anim: 'slide', y: 0.86 } },
  { id: 'poster', he: 'פוסטר', en: 'Poster', style: { font: 'Karantina', size: 14, color: '#ffffff', outline: 5, outlineColor: '#000000', shadow: false, box: false, anim: 'zoom', y: 0.3 } },
  { id: 'hand', he: 'כתב יד', en: 'Handwritten', style: { font: 'Amatic SC', size: 11, color: '#ffffff', outline: 0, shadow: true, box: false, anim: 'fade', y: 0.3 } },
  { id: 'classic', he: 'קלאסי', en: 'Classic serif', style: { font: 'Frank Ruhl Libre', size: 7, color: '#ffffff', outline: 0, shadow: true, box: false, anim: 'fade', y: 0.3 } },
  { id: 'neon', he: 'ניאון', en: 'Neon', style: { font: 'Varela Round', size: 7, color: '#5cffa3', outline: 8, outlineColor: '#07301c', shadow: false, box: false, anim: 'pop', y: 0.3 } },
  { id: 'note', he: 'כיתוב קטן', en: 'Small note', style: { font: 'Assistant', size: 4, color: '#ffffff', outline: 8, outlineColor: '#000000', shadow: false, box: false, anim: 'none', y: 0.7 } },
];

export const CAPTION_PRESETS = [
  { id: 'highlight', he: 'הדגשת מילה', en: 'Word highlight', style: { font: 'Heebo', size: 5.2, color: '#ffffff', highlight: '#ffd400', outline: 9, outlineColor: '#000000', box: false, mode: 'word' } },
  { id: 'classic', he: 'קלאסי', en: 'Classic', style: { font: 'Assistant', size: 4.6, color: '#ffffff', highlight: '#ffffff', outline: 8, outlineColor: '#000000', box: false, mode: 'none' } },
  { id: 'box', he: 'קופסה', en: 'Boxed', style: { font: 'Heebo', size: 4.4, color: '#ffffff', highlight: '#4ade80', outline: 0, box: true, boxColor: '#000000', boxOpacity: 0.72, mode: 'word' } },
  { id: 'karaoke', he: 'קריוקי', en: 'Karaoke', style: { font: 'Rubik', size: 5, color: '#ffffff', highlight: '#38bdf8', outline: 9, outlineColor: '#000000', box: false, mode: 'karaoke' } },
  { id: 'single', he: 'מילה-מילה', en: 'One word', style: { font: 'Secular One', size: 8, color: '#ffffff', highlight: '#ffd400', outline: 9, outlineColor: '#000000', box: false, mode: 'single' } },
  { id: 'clean', he: 'נקי בהיר', en: 'Clean light', style: { font: 'Assistant', size: 4.4, color: '#111111', highlight: '#e11d48', outline: 0, box: true, boxColor: '#ffffff', boxOpacity: 0.94, mode: 'word' } },
  { id: 'poster', he: 'פוסטר ירוק', en: 'Poster green', style: { font: 'Karantina', size: 8.5, color: '#ffffff', highlight: '#4ade80', outline: 6, outlineColor: '#000000', box: false, mode: 'word' } },
];

export const ANIMS = ['none', 'fade', 'slide', 'pop', 'zoom'];
export const CAPTION_MODES = ['none', 'word', 'karaoke', 'single'];
