// חמישה שירים לכל סט מפורסם, מהלהקה של המתופף – לנגן יחד עם הסט.
// המזהים נבדקו מול oEmbed של יוטיוב (ערוץ רשמי של הלהקה / VEVO). חובה שהסרטון יהיה ניתן להטמעה.
// note: הערה קצרה בעברית על התיפוף (לא חובה)

export const KIT_SONGS = {
  bonham: [
    { title: 'When the Levee Breaks', artist: 'Led Zeppelin', youtubeId: 'JM3fodiK9rY', note: 'הגרוב המפורסם של בונהם' },
    { title: 'Rock and Roll', artist: 'Led Zeppelin', youtubeId: 'D2lSwosw9xY', note: 'פתיחה מהירה וחזקה' },
    { title: 'Good Times Bad Times', artist: 'Led Zeppelin', youtubeId: 'TA9Rec1qAFQ', note: 'בס כפול בלי בס כפול' },
    { title: 'Kashmir', artist: 'Led Zeppelin', youtubeId: 'ww9484EM2OQ', note: 'קצב כבד ואיטי' },
    { title: 'Black Dog', artist: 'Led Zeppelin', youtubeId: '2KPEHohJMuw', note: 'קצב שמשתנה באמצע' },
  ],
  ringo: [
    { title: 'Come Together', artist: 'The Beatles', youtubeId: '45cYwDMibGo', note: 'טומים מקוריים וגרוב רגוע' },
    { title: 'Ticket to Ride', artist: 'The Beatles', youtubeId: 'SyNt5zm3U_M', note: 'תיפוף יוצא דופן לתקופה' },
    { title: 'Hey Jude', artist: 'The Beatles', youtubeId: 'A_MjCqQoLLA', note: 'מחכים לכניסה הגדולה' },
    { title: 'Help!', artist: 'The Beatles', youtubeId: '2Q_ZzBGPdqE', note: 'קצב מהיר וישר' },
    { title: 'Rain', artist: 'The Beatles', youtubeId: 'cK5G8fPmWeA', note: 'אחד התיפופים הטובים של רינגו' },
  ],
  peart: [
    { title: 'Tom Sawyer', artist: 'Rush', youtubeId: 'auLBLk4ibAk', note: 'מילוי מפורסם באמצע' },
    { title: 'Limelight', artist: 'Rush', youtubeId: 'ZiRuj2_czzw', note: 'גרוב נקי ומדויק' },
    { title: 'YYZ', artist: 'Rush', youtubeId: 'ftVTWDrtrlc', note: 'קצב מורכב, לחובבי אתגר' },
    { title: 'The Spirit of Radio', artist: 'Rush', youtubeId: 'g_QtO0Rhp0w' },
    { title: 'Subdivisions', artist: 'Rush', youtubeId: 'EYYdQB0mkEU' },
  ],
  barker: [
    { title: "What's My Age Again?", artist: 'blink-182', youtubeId: 'K7l5ZeVVoCA', note: 'פאנק מהיר' },
    { title: 'All The Small Things', artist: 'blink-182', youtubeId: '9Ht5RZpzPqw', note: 'קל יחסית להתחלה' },
    { title: 'Dammit', artist: 'blink-182', youtubeId: 'sT0g16_LQaQ' },
    { title: 'The Rock Show', artist: 'blink-182', youtubeId: 'z7hhDINyBP0' },
    { title: 'First Date', artist: 'blink-182', youtubeId: 'vVy9Lgpg1m8' },
  ],
  grohl: [
    { title: 'Smells Like Teen Spirit', artist: 'Nirvana', youtubeId: 'hTWKbfoikeg', note: 'המילוי הכי מפורסם בגראנג׳' },
    { title: 'In Bloom', artist: 'Nirvana', youtubeId: 'PbgKEjNBHqM' },
    { title: 'Lithium', artist: 'Nirvana', youtubeId: 'pkcJEvMcnEg' },
    { title: 'Breed', artist: 'Nirvana', youtubeId: 'J6EDW5WFb2M', note: 'מהיר וקצבי' },
    { title: 'No One Knows', artist: 'Queens of the Stone Age', youtubeId: 's88r_q7oufE', note: 'גרוהל על התופים' },
  ],
  porcaro: [
    { title: 'Rosanna', artist: 'Toto', youtubeId: 'qmOLtTGvsbM', note: 'הגרוב המפורסם "חצי שאפל"' },
    { title: 'Africa', artist: 'Toto', youtubeId: 'FTQbiNvZqaY' },
    { title: 'Hold the Line', artist: 'Toto', youtubeId: 'htgr3pvBr-I' },
    { title: 'Pamela', artist: 'Toto', youtubeId: 'QCq9751mOFo' },
    { title: 'Georgy Porgy', artist: 'Toto', youtubeId: 'EWIgEtkE3GA', note: 'גרוב רך וקליל' },
  ],
  chadsmith: [
    { title: "Can't Stop", artist: 'Red Hot Chili Peppers', youtubeId: '8DyziWtkfBw', note: 'גרוב פאנקי' },
    { title: 'Give It Away', artist: 'Red Hot Chili Peppers', youtubeId: 'Mr_uHJPUlO8' },
    { title: 'Under the Bridge', artist: 'Red Hot Chili Peppers', youtubeId: 'GLvohMXgcBo', note: 'שקט, ואז כניסה חזקה' },
    { title: 'Dani California', artist: 'Red Hot Chili Peppers', youtubeId: 'Sb5aq5HcS1A' },
    { title: 'Californication', artist: 'Red Hot Chili Peppers', youtubeId: 'YlUKcNNmywk', note: 'קצב פשוט ויפה' },
  ],
  ulrich: [
    { title: 'Enter Sandman', artist: 'Metallica', youtubeId: 'CD-E-LDc384', note: 'קל וכבד, מתחילים מכאן' },
    { title: 'Master of Puppets', artist: 'Metallica', youtubeId: '6xjJ2XIbGRk', note: 'מהיר, בס כפול' },
    { title: 'One', artist: 'Metallica', youtubeId: 'WM8bTdBs-cw' },
    { title: 'Fuel', artist: 'Metallica', youtubeId: 'G1cjHbXdU0s' },
    { title: 'Sad But True', artist: 'Metallica', youtubeId: 'A8MO7fkZc5o', note: 'כבד ואיטי' },
  ],
};

// שירים של סט (מזהה סט מפורסם) – רשימה ריקה אם אין
export function songsForKit(kitId) {
  return (typeof kitId === 'string' && KIT_SONGS[kitId]) || [];
}

export function youtubeUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}
