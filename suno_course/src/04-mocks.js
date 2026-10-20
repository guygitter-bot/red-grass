// ===== איורי המסכים =====
const MOCK = {};

// --- סונו: עמוד היצירה במצב Custom ---
MOCK.sunoCreate = () => mock({
  app: 'suno', url: 'suno.com/create', h: 460, wide: true,
  cap: 'עמוד היצירה של סונו במצב Custom. הסידור המדויק משתנה בין גרסאות, אבל השדות האלה תמיד שם.',
  body:
    A(0, 0, 14, 100, 's-side', `<div style="padding:12px 10px;display:grid;gap:12px">
      <b style="font-size:15px;letter-spacing:.12em">SUNO</b>
      <span class="s-dim">Home</span><span style="color:#fff;font-weight:700">Create</span><span class="s-dim">Library</span>
      <span class="s-dim">Explore</span><span class="s-dim">Studio</span><span class="s-dim">Search</span></div>`) +
    A(1, 86, 12, 10, '', `<div class="s-dim" style="font-size:11px">Pro plan<br><b style="color:#F7B733">2,450 credits</b></div>`) +
    A(16, 3, 22, 7, '', `<span class="s-tab">Simple</span> <span class="s-tab on">Custom</span>`) +
    A(40, 3, 9, 7, 's-in', `v6 ▾`, 'padding:4px 8px;text-align:center') +
    A(16, 12, 33, 21, 's-in', `<div class="s-dim" style="font-size:11px">Lyrics</div>[Intro]<br>[Instrumental]<br>[Outro]<div style="position:absolute;right:8px;bottom:6px" class="s-dim">✨ Write</div>`) +
    A(16, 35, 33, 7, 's-in', `Instrumental <span style="float:right;background:#F7B733;border-radius:99px;width:30px;height:16px;display:inline-block"></span>`, 'padding:6px 8px') +
    A(16, 44, 33, 15, 's-in', `<div class="s-dim" style="font-size:11px">Styles</div>lofi hip hop, 75 BPM, mellow Rhodes, dusty drums, vinyl crackle, rainy night, instrumental, no vocals`) +
    A(16, 60, 33, 6, '', `<span class="s-tab">+ jazz</span> <span class="s-tab">+ chill</span> <span class="s-tab">+ ambient</span>`) +
    A(16, 67, 33, 14, 's-in', `<div class="s-dim" style="font-size:11px">More Options ▾</div>Exclude styles: vocals, singing, choir<br>Weirdness <b>35%</b> · Style Influence <b>70%</b>`) +
    A(16, 82, 33, 6, 's-in', `<span class="s-dim">Title:</span> Rainy Window 01`, 'padding:5px 8px') +
    A(16, 90, 33, 7, 's-btn', `♪ Create`, 'height:auto') +
    A(52, 3, 46, 7, '', `<b style="font-size:13px">My Workspace</b> <span class="s-dim">· Filters · Search</span>`) +
    [0, 1, 2, 3].map(i => A(52, 13 + i * 15, 46, 12, '', `<div style="display:flex;gap:8px;align-items:center;height:100%">
      <span style="width:44px;height:44px;border-radius:6px;background:linear-gradient(135deg,#3b2f6e,#d17b4a)"></span>
      <span style="flex:1"><b>Rainy Window 0${i + 1}</b><br><span class="s-dim">lofi hip hop, 75 BPM… · v6</span></span>
      <span class="s-dim">${['3:41', '3:12', '4:05', '2:58'][i]}</span><span style="font-size:16px">⋯</span></div>`)).join(''),
  pins: [
    [15, 6, '<b>Custom</b> – המצב שבו כותבים בעצמכם סגנון, מילים וכותרת. ב-Simple רק כותבים תיאור קצר וסונו מחליט על השאר. לערוץ עובדים תמיד ב-Custom.'],
    [50.5, 6, '<b>בחירת המודל</b> – v6 היא הגרסה החדשה בתשלום (מספטמבר 2026), v6-mini חינמית ומהירה יותר.'],
    [15, 22, '<b>Lyrics (מילים)</b> – בשיר בלי שירה כותבים כאן רק תגיות מבנה בסוגריים מרובעים, כמו [Instrumental].'],
    [15, 38.5, '<b>Instrumental</b> – להדליק תמיד במוזיקת רקע. זה המתג שאומר לסונו: בלי זמר.'],
    [15, 51, '<b>Styles (סגנון)</b> – השדה הכי חשוב. כאן מדביקים את הפרומפט מהמחולל שבפרק 8.'],
    [15, 74, '<b>אפשרויות נוספות</b> – Exclude styles (מה לא לכלול), Weirdness (כמה "מוזר" ויצירתי) ו-Style Influence (כמה להיצמד לסגנון).'],
    [15, 85, '<b>Title</b> – שם השיר. השם מופיע בקובץ ואחר כך ברשימת השירים בתיאור הסרטון.'],
    [15, 93.5, '<b>Create</b> – כל לחיצה מייצרת שתי גרסאות ומורידה קרדיטים.'],
    [97, 11, '<b>⋯ תפריט השיר</b> – מכאן מאריכים, עורכים ומורידים. מוסבר בפרק 7.'],
    [11, 84, '<b>יתרת קרדיטים</b> – בודקים לפני סשן יצירה גדול.']
  ]
});

// --- סונו: תפריט שיר ---
MOCK.sunoMenu = () => mock({
  app: 'suno', url: 'suno.com/create', h: 380, wide: true,
  cap: 'תפריט שלוש הנקודות (⋯) ליד שיר. ממנו עוברים לעריכה, להארכה ולהורדה.',
  body:
    A(3, 6, 50, 14, '', `<div style="display:flex;gap:8px;align-items:center">
      <span style="width:46px;height:46px;border-radius:6px;background:linear-gradient(135deg,#1f4d5a,#a3d5c3)"></span>
      <span><b>Morning Café 03</b><br><span class="s-dim">bossa nova, 105 BPM… · 3:22</span></span><span style="margin-left:auto;font-size:18px">⋯</span></div>`) +
    A(30, 22, 30, 74, 's-in', `<div style="display:grid;gap:9px">
      <span style="color:#fff">Remix/Edit ▸</span><span>Get Stems</span><span>Remaster</span><span style="color:#fff">Download ▸</span>
      <span>Add to Playlist</span><span>Share</span><span>Make Public</span><span class="s-dim">Move to Trash</span></div>`) +
    A(62, 18, 34, 54, 's-in', `<div style="display:grid;gap:9px">
      <span>Cover</span><span style="color:#fff">Extend</span><span>Reuse Prompt</span><span>Replace Section</span><span>Crop</span><span>Adjust Speed</span></div>`) +
    A(62, 75, 34, 22, 's-in', `<div style="display:grid;gap:7px"><span>MP3 Audio</span><span style="color:#fff">WAV Audio</span><span>Video</span></div>`),
  pins: [
    [57, 27, '<b>Remix/Edit</b> – תפריט העריכה. נפתח לצד ימין.'],
    [70, 30, '<b>Extend</b> – ממשיכים את השיר מנקודה שבוחרים. כך הופכים קטע של 3 דקות לטראק של 6–8 דקות (פחות הורדות לכל סרטון).'],
    [73, 38, '<b>Reuse Prompt</b> – יוצר שיר חדש עם אותו פרומפט בדיוק. הדרך הכי מהירה לבנות פלייליסט אחיד.'],
    [74, 46, '<b>Replace Section</b> – מחליפים רק חלק בעייתי (למשל מקום ששמעו בו פתאום קול). זמין במסלולים בתשלום.'],
    [52, 41, '<b>Get Stems</b> – מפריד לערוצים (תופים, בס, פסנתר…). שימושי אם רוצים לערבב או לנקות.'],
    [74, 84, '<b>Download ▸ WAV</b> – הורדה באיכות הכי גבוהה. כל הורדה נספרת במכסה החודשית, לכן מורידים רק שירים שנבחרו.']
  ]
});

// --- יוטיוב: יצירת ערוץ ---
MOCK.ytCreate = () => mock({
  app: 'yt', url: 'youtube.com/create_channel', h: 360,
  cap: 'החלון שנפתח בלחיצה על תמונת הפרופיל ← Create a channel (יצירת ערוץ).',
  body:
    A(0, 0, 100, 100, '', '', 'background:#0006') +
    A(20, 7, 60, 86, '', `<div style="background:#fff;border-radius:12px;height:100%;padding:16px;display:grid;gap:10px;justify-items:center;align-content:start">
      <b style="font-size:15px">How you'll appear</b>
      <span style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#7bc6b5,#2b5d74)"></span>
      <span style="color:#065FD4;font-weight:600">Select picture</span>
      <div class="y-in" style="width:80%"><span class="y-dim" style="font-size:10px">Name</span><br>Rainy Window Lofi</div>
      <div class="y-in" style="width:80%"><span class="y-dim" style="font-size:10px">Handle</span><br>@rainywindowlofi</div>
      <span class="y-dim" style="font-size:10px;width:80%">By clicking Create channel you agree to YouTube's Terms of Service.</span>
      <div style="width:80%;text-align:right"><span class="y-dim">Cancel</span> &nbsp; <span style="color:#065FD4;font-weight:700">Create channel</span></div></div>`),
  pins: [
    [57, 24, '<b>Select picture</b> – תמונת הערוץ (לוגו). עדיף ציור ייחודי בסגנון של הערוץ, לא תמונה שלכם.'],
    [80, 46, '<b>Name</b> – שם הערוץ. קצר, זכיר, ומרמז על האווירה (פרק 3).'],
    [80, 60, '<b>Handle</b> – הכתובת עם @. כדאי שיהיה זהה לשם, באותיות לטיניות.'],
    [72, 86, '<b>Create channel</b> – לוחצים, והערוץ קיים.']
  ]
});

// --- יוטיוב סטודיו: לוח הבקרה ---
const ytSide = (on) => A(0, 0, 18, 100, 'y-side', `<div style="padding:12px 10px;display:grid;gap:11px">
  <span style="display:flex;gap:6px;align-items:center"><span class="y-red" style="border-radius:4px;padding:1px 5px;font-size:10px">▶</span><b>Studio</b></span>
  ${['Dashboard', 'Content', 'Analytics', 'Community', 'Subtitles', 'Copyright', 'Earn', 'Customization', 'Audio library'].map(x => `<span style="${x === on ? 'font-weight:700;color:#0F0F0F' : 'color:#606060'}">${x}</span>`).join('')}</div>`);

MOCK.ytDash = () => mock({
  app: 'yt', url: 'studio.youtube.com', h: 420, wide: true,
  cap: 'YouTube Studio – המקום שבו מנהלים את הערוץ. נכנסים מ-studio.youtube.com או מתמונת הפרופיל ← YouTube Studio.',
  body:
    ytSide('Dashboard') +
    A(20, 2, 78, 8, '', `<div style="display:flex;gap:10px;align-items:center"><span class="y-in" style="flex:1">Search across your channel</span><span style="border:1px solid #ccc;border-radius:4px;padding:5px 10px;font-weight:700">⊕ CREATE</span></div>`) +
    A(20, 14, 40, 8, '', `<b style="font-size:16px">Channel dashboard</b>`) +
    A(20, 24, 25, 70, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px;height:100%"><b>Latest video performance</b><div style="height:60px;background:linear-gradient(135deg,#334,#a76);border-radius:6px;margin:8px 0"></div><span class="y-dim">First 2 days 1 hour:<br>Views 812 · Watch time 64.3h</span></div>`) +
    A(47, 24, 25, 70, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px;height:100%"><b>Channel analytics</b><br><span class="y-dim">Current subscribers</span><br><b style="font-size:20px">642</b><br><span class="y-dim">Summary · Last 28 days<br>Views 18.4K<br>Watch time (hours) 1,206</span></div>`) +
    A(74, 24, 24, 70, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px;height:100%"><b>Ideas for you</b><br><span class="y-dim">Inspiration and research topics your audience searches for</span></div>`),
  pins: [
    [94, 6, '<b>CREATE ← Upload videos</b> – מכאן מעלים סרטון חדש (פרק 11).'],
    [6, 16, '<b>Content</b> – כל הסרטונים, הפלייליסטים וה-Shorts.'],
    [6, 21, '<b>Analytics</b> – נתוני צפיות, זמן צפייה, מנויים והכנסות. משם מייצאים נתונים לכלי המעקב בפרק 16.'],
    [6, 37, '<b>Copyright</b> – תביעות זכויות על סרטונים שלכם (פרק 13).'],
    [5, 42, '<b>Earn</b> – תוכנית השותפים: כמה חסר עד המונטיזציה, ומכאן מגישים בקשה (פרק 15).'],
    [8, 47, '<b>Customization</b> – תמונה, באנר, תיאור, קישורים והסרטון המוצג בעמוד הערוץ.'],
    [60, 50, '<b>Channel analytics</b> – תמונת מצב מהירה של 28 הימים האחרונים.']
  ]
});

// --- יוטיוב סטודיו: העלאה – פרטים ---
const ytSteps = on => A(4, 3, 92, 8, '', `<div style="display:flex;justify-content:space-between;align-items:center;color:#606060">${['Details', 'Video elements', 'Checks', 'Visibility'].map(x => `<span style="${x === on ? 'color:#065FD4;font-weight:700' : ''}">● ${x}</span>`).join('<span style="flex:1;border-top:1px solid #ccc;margin:0 6px"></span>')}</div>`);

MOCK.ytDetails = () => mock({
  app: 'yt', url: 'studio.youtube.com – Upload videos', h: 520, wide: true,
  cap: 'שלב Details (פרטים) בחלון ההעלאה. זה השלב החשוב ביותר לקידום.',
  body:
    ytSteps('Details') +
    A(4, 13, 60, 11, 'y-in', `<span class="y-dim" style="font-size:10px">Title (required)</span><br>Rainy Night Lofi 🌧️ 1 Hour of Chill Beats to Study & Relax`) +
    A(4, 26, 60, 21, 'y-in', `<span class="y-dim" style="font-size:10px">Description</span><br>Cozy lofi beats for a rainy night of studying…<br>00:00 Rainy Window<br>03:41 Soft Lamp Light<br>06:53 Tea at Midnight…`) +
    A(4, 49, 60, 15, '', `<b>Thumbnail</b><div style="display:flex;gap:6px;margin-top:4px"><span style="border:1px dashed #aaa;border-radius:4px;padding:8px;font-size:10px">⬆ Upload file</span><span style="border:1px dashed #aaa;border-radius:4px;padding:8px;font-size:10px">Auto-generated</span><span style="border:1px dashed #aaa;border-radius:4px;padding:8px;font-size:10px">⚗ Test & compare</span></div>`) +
    A(4, 66, 60, 10, '', `<b>Playlists</b><div class="y-in" style="margin-top:3px">Rainy Lofi Collection ▾</div>`) +
    A(4, 78, 60, 18, '', `<b>Audience</b><br><span class="y-dim" style="font-size:10px">Is this video made for kids? (required)</span><br>○ Yes, it's made for kids<br>◉ No, it's not made for kids<br><span style="color:#065FD4;font-weight:600">Show more</span>`) +
    A(67, 13, 29, 40, '', `<div style="background:#111;height:60%;border-radius:6px;background-image:linear-gradient(135deg,#2c3e66,#d08b5b)"></div><div style="background:#f2f2f2;padding:6px;font-size:10px;border-radius:0 0 6px 6px"><span class="y-dim">Video link</span><br><span style="color:#065FD4">youtu.be/xxxxxxx</span><br><span class="y-dim">Filename</span><br>rainy-night-lofi-1h.mp4</div>`) +
    A(80, 90, 16, 7, 'y-blue', `NEXT`, 'text-align:center'),
  pins: [
    [50, 6, '<b>ארבעת השלבים</b> – Details (פרטים) ← Video elements (רכיבי וידאו) ← Checks (בדיקות) ← Visibility (חשיפה).'],
    [62, 17, '<b>Title</b> – כותרת: מה, לאיזה מצב, כמה זמן. עד 100 תווים, החשוב בהתחלה. המחולל בפרק 11 כותב אותה.'],
    [62, 32, '<b>Description</b> – תיאור עם רשימת שירים ושעות. השעות יוצרות "פרקים" (Chapters) אוטומטית.'],
    [17, 57, '<b>Upload file</b> – תמונה ממוזערת משלכם: 1280×720, עד 2MB. בלי זה יוטיוב בוחר פריים מהסרטון.'],
    [50, 57, '<b>Test & compare</b> – בדיקה של עד 3 תמונות (ו-3 כותרות) כדי לראות מה מחזיק צופים יותר.'],
    [62, 72, '<b>Playlists</b> – מוסיפים מיד לפלייליסט הנכון. פלייליסטים מאריכים את זמן ההאזנה.'],
    [30, 87, '<b>Audience</b> – מוזיקה למבוגרים ← "No, it\'s not made for kids". סימון "לילדים" מבטל תגובות ומוריד הכנסה.'],
    [15, 94, '<b>Show more</b> – כאן מסתתרת שאלת התוכן הסינתטי (AI). חובה לפתוח.'],
    [82, 44, '<b>Video link</b> – הקישור לסרטון עוד לפני הפרסום. שימושי לשיתוף.']
  ]
});

// --- יוטיוב: Show more ---
MOCK.ytMore = () => mock({
  app: 'yt', url: 'studio.youtube.com – Upload videos', h: 440, wide: true,
  cap: 'מה שנפתח מתחת ל-Show more באותו שלב Details.',
  body:
    A(4, 4, 92, 30, '', `<b>Altered content</b><br><span class="y-dim" style="font-size:10.5px">Do any of the following describe your content? • Makes a real person appear to say or do something they didn't • Alters footage of a real event or place • Generates a realistic-looking scene that didn't actually occur</span><br><br>◉ Yes &nbsp; ○ No`) +
    A(4, 37, 44, 10, 'y-in', `<span class="y-dim" style="font-size:10px">Tags</span><br>lofi, study music, rainy night`) +
    A(52, 37, 44, 10, 'y-in', `<span class="y-dim" style="font-size:10px">Video language</span><br>English ▾`) +
    A(4, 51, 44, 10, 'y-in', `<span class="y-dim" style="font-size:10px">License</span><br>Standard YouTube License ▾`) +
    A(52, 51, 44, 10, 'y-in', `<span class="y-dim" style="font-size:10px">Category</span><br>Music ▾`) +
    A(4, 65, 92, 12, '', `<b>Comments and ratings</b><br><span class="y-dim">Comments: On ▾ · Sort by: Top</span>`) +
    A(4, 80, 92, 14, '', `<b>Shorts remixing</b><br><span class="y-dim">◉ Allow video and audio remixing</span>`),
  pins: [
    [10, 26, '<b>Altered content (תוכן משונה/סינתטי)</b> – אם יש בסרטון תמונות או סרטונים מציאותיים שנוצרו ב-AI – מסמנים Yes. למוזיקה מסונו ההנחיות לא חד-משמעיות; ההמלצה שלנו: לסמן Yes. זה לא פוגע בהכנסה ומגן עליכם.'],
    [44, 42, '<b>Tags</b> – משפיע מעט. 5–10 מילים מדויקות, בלי "פיזור" של מילים שלא קשורות.'],
    [92, 42, '<b>Video language</b> – השפה של הכותרת והתיאור.'],
    [92, 56, '<b>Category</b> – Music.'],
    [44, 70, '<b>Comments</b> – להשאיר פתוח. תגובות הן סימן לתוכן אמיתי ולקהילה.']
  ]
});

// --- יוטיוב: Visibility ---
MOCK.ytVis = () => mock({
  app: 'yt', url: 'studio.youtube.com – Upload videos', h: 340, wide: true,
  cap: 'השלב האחרון: Visibility (חשיפה).',
  body:
    ytSteps('Visibility') +
    A(4, 16, 60, 48, '', `<div style="border:1px solid #ddd;border-radius:6px;padding:10px;display:grid;gap:7px"><b>Save or publish</b>
      <span>○ Private <span class="y-dim">– only you</span></span><span>○ Unlisted <span class="y-dim">– anyone with the link</span></span><span>○ Public <span class="y-dim">– everyone</span></span>
      <span style="padding-left:14px">☐ Set as instant Premiere</span></div>`) +
    A(4, 68, 60, 22, '', `<div style="border:1px solid #065FD4;border-radius:6px;padding:10px"><b>◉ Schedule</b><br>Fri, Oct 24, 2026 &nbsp; 18:00 &nbsp; (GMT+3) Jerusalem</div>`) +
    A(80, 88, 16, 8, 'y-blue', `SCHEDULE`, 'text-align:center'),
  pins: [
    [40, 32, '<b>Private / Unlisted / Public</b> – פרטי (רק אתם), לא-רשום (רק עם קישור), ציבורי.'],
    [30, 55, '<b>Premiere</b> – הקרנת בכורה עם צ\'אט. נחמד לסרטונים גדולים, לא חובה.'],
    [55, 78, '<b>Schedule</b> – תזמון. מעלים מראש ובוחרים שעה קבועה, לפי הזמנים שבהם הקהל שלכם צופה (Analytics ← Audience).'],
    [88, 92, '<b>SCHEDULE</b> – שומרים. הסרטון יעלה לבד.']
  ]
});

// --- יוטיוב: Earn ---
MOCK.ytEarn = () => mock({
  app: 'yt', url: 'studio.youtube.com – Earn', h: 380, wide: true,
  cap: 'לשונית Earn (הכנסות) לפני שהערוץ עומד בתנאים. המספרים כאן הם דוגמה.',
  body:
    ytSide('Earn') +
    A(21, 4, 76, 10, '', `<b style="font-size:16px">Earn</b> &nbsp; <span class="y-dim">Join the YouTube Partner Program</span>`) +
    A(21, 17, 76, 30, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px;display:grid;gap:7px">
      <span>Subscribers <b style="float:right">642 / 1,000</b></span><div style="height:6px;background:#eee;border-radius:9px"><div style="width:64%;height:100%;background:#065FD4;border-radius:9px"></div></div>
      <span>Public watch hours (last 365 days) <b style="float:right">2,310 / 4,000</b></span><div style="height:6px;background:#eee;border-radius:9px"><div style="width:58%;height:100%;background:#065FD4;border-radius:9px"></div></div>
      <span class="y-dim">or Public Shorts views (90 days) 0.2M / 10M</span></div>`) +
    A(21, 52, 76, 20, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px"><b>Early access: fan funding</b><br><span class="y-dim">500 subscribers · 3 public uploads in 90 days · 3,000 watch hours</span></div>`) +
    A(21, 78, 30, 9, 'y-blue', `GET NOTIFIED`, 'text-align:center'),
  pins: [
    [94, 26, '<b>מנויים</b> – צריך 1,000 לתוכנית המלאה (עם פרסומות).'],
    [94, 33, '<b>שעות צפייה ציבוריות ב-365 הימים האחרונים</b> – 4,000 (נכון לאוקטובר 2026; דווח שמ-1.2.2027 יעלה ל-8,000 למצטרפים חדשים).'],
    [94, 60, '<b>השלב המוקדם</b> – מאפשר רק חברויות ותרומות, בלי פרסומות. פחות רלוונטי לערוץ מוזיקה.'],
    [36, 83, '<b>Get notified / Apply</b> – כשמגיעים לתנאים הכפתור הופך ל-Apply (להגיש).']
  ]
});

// --- יוטיוב: Analytics ---
MOCK.ytAnalytics = () => mock({
  app: 'yt', url: 'studio.youtube.com – Analytics', h: 380, wide: true,
  cap: 'מסך Analytics. מכאן לוקחים את המספרים לכלי המעקב בפרק 16.',
  body:
    ytSide('Analytics') +
    A(21, 3, 60, 8, '', `<b style="font-size:16px">Channel analytics</b>`) +
    A(84, 3, 14, 8, '', `<span style="color:#065FD4;font-weight:600">Advanced mode</span>`) +
    A(21, 12, 76, 8, '', `<span style="border-bottom:2px solid #0F0F0F;padding-bottom:4px;font-weight:700">Overview</span> &nbsp; Content &nbsp; Audience &nbsp; Revenue &nbsp; Inspiration`) +
    A(21, 24, 76, 16, '', `<div style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e5e5e5;border-radius:6px">${[['Views', '18.4K'], ['Watch time (hours)', '1,206'], ['Subscribers', '+212'], ['Estimated revenue', '$0.00']].map(x => `<div style="padding:8px;border-right:1px solid #eee"><span class="y-dim" style="font-size:10px">${x[0]}</span><br><b style="font-size:15px">${x[1]}</b></div>`).join('')}</div>`) +
    A(21, 44, 76, 50, '', `<svg viewBox="0 0 300 100" preserveAspectRatio="none" style="width:100%;height:100%"><rect width="300" height="100" fill="#fff"/><polyline fill="none" stroke="#065FD4" stroke-width="2" points="0,90 30,85 60,80 90,82 120,70 150,62 180,55 210,48 240,35 270,30 300,22"/></svg>`),
  pins: [
    [90, 7, '<b>Advanced mode</b> – טבלה מפורטת. בפינה יש כפתור ייצוא (חץ למטה) ← Comma-separated values (.csv). את הקובץ הזה מעלים לכלי המעקב.'],
    [72, 16, '<b>Revenue</b> – מופיע רק אחרי שמתקבלים לתוכנית: RPM, הכנסה לפי סרטון וסוג פרסומת.'],
    [87, 16, '<b>Inspiration / Research</b> – מה הקהל שלכם מחפש. מקור מצוין לרעיונות לנושאים.'],
    [40, 32, '<b>Watch time (hours)</b> – המספר שחשוב לסף 4,000 השעות.']
  ]
});

// --- קאפקאט: מסך העריכה ---
MOCK.capcut = () => mock({
  app: 'cc', url: 'CapCut Desktop – Project 1', h: 470, wide: true,
  cap: 'CapCut למחשב: מסך העריכה עם סרטון לולאה ורצועת אודיו של שעה.',
  body:
    A(0, 0, 100, 8, 'c-panel', `<div style="display:flex;gap:14px;align-items:center;height:100%;padding:0 10px"><span>☰ CapCut</span>${['Media', 'Audio', 'Text', 'Stickers', 'Effects', 'Transitions', 'Filters', 'Adjustment'].map((x, i) => `<span style="${i === 0 ? 'color:#2fd3c5;font-weight:700' : ''}">${x}</span>`).join('')}<span style="margin-left:auto;background:#2fd3c5;color:#111;border-radius:5px;padding:3px 12px;font-weight:700">⬆ Export</span></div>`) +
    A(0, 9, 28, 50, 'c-panel', `<div style="padding:8px"><span style="background:#2fd3c5;color:#111;border-radius:5px;padding:4px 10px;font-weight:700">+ Import</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">${['loop_rain.mp4', 'track01.wav', 'track02.wav', 'logo.png'].map((x, i) => `<div><div style="height:34px;border-radius:4px;background:${i ? '#2b3b3a' : 'linear-gradient(135deg,#2c3e66,#d08b5b)'}"></div><span class="c-dim" style="font-size:10px">${x}</span></div>`).join('')}</div></div>`) +
    A(29, 9, 44, 50, 'c-panel', `<div style="height:100%;display:grid;place-items:center"><div style="width:86%;aspect-ratio:16/9;background:linear-gradient(135deg,#2c3e66,#d08b5b);border-radius:4px;position:relative"><span style="position:absolute;left:8px;bottom:8px;font-size:11px">Rainy Night Lofi</span></div></div>`) +
    A(74, 9, 26, 50, 'c-panel', `<div style="padding:8px;display:grid;gap:6px"><b>Video</b><span class="c-dim">Basic · Animation · Speed</span><span>Scale 100%</span><span>Opacity 100%</span><span>Speed 1.0x</span></div>`) +
    A(0, 60, 100, 40, 'c-panel', `<div style="padding:6px 8px;display:grid;gap:5px;font-size:10px">
      <div class="c-dim" style="display:flex;justify-content:space-between"><span>00:00</span><span>15:00</span><span>30:00</span><span>45:00</span><span>01:00:00</span></div>
      <div style="display:flex;gap:2px;height:20px">${Array(10).fill('<span style="flex:1;background:#3d5a80;border-radius:3px"></span>').join('')}</div>
      <div style="display:flex;gap:2px;height:14px">${Array(3).fill('<span style="flex:1;background:#7a5af5;border-radius:3px;padding-left:4px">Rainy Night Lofi</span>').join('')}<span style="flex:7"></span></div>
      <div style="display:flex;gap:2px;height:22px">${['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(n => `<span style="flex:1;background:#1f7a5c;border-radius:3px;padding-left:4px">track${n}</span>`).join('')}</div></div>`),
  pins: [
    [7, 13, '<b>Import</b> – מייבאים את סרטון הלולאה, את קובצי השירים ואת הלוגו.'],
    [6, 4, '<b>Media / Audio / Text / Effects</b> – הלשוניות העליונות: טקסט, אפקטים ומעברים.'],
    [51, 34, '<b>Player</b> – תצוגה מקדימה. בודקים שהלולאה חלקה בלי "קפיצה".'],
    [87, 22, '<b>Properties</b> – כאן משנים גודל, מהירות והנפשה של הפריט שנבחר.'],
    [50, 75, '<b>רצועת וידאו</b> – אותו קליפ לולאה, משוכפל לכל אורך השעה.'],
    [15, 83, '<b>רצועת טקסט</b> – שם הערוץ או שם הסרטון. אפשר גם שם השיר שמתנגן.'],
    [60, 92, '<b>רצועת אודיו</b> – השירים אחד אחרי השני, עם מעבר רך (fade) ביניהם.'],
    [93, 4, '<b>Export</b> – יצוא הסרטון הגמור.']
  ]
});

// --- קאפקאט: חלון הייצוא ---
MOCK.capExport = () => mock({
  app: 'cc', url: 'CapCut Desktop – Export', h: 380, wide: true,
  cap: 'חלון Export. אלה ההגדרות שמתאימות ליוטיוב.',
  body:
    A(18, 4, 64, 92, 'c-panel', `<div style="padding:12px;display:grid;gap:9px;border-radius:8px">
      <b style="font-size:14px">Export</b>
      <span>Title &nbsp; <span style="background:#18181a;padding:3px 8px;border-radius:4px">rainy-night-lofi-1h</span></span>
      <span>Export to &nbsp; <span class="c-dim">C:\\Videos\\Channel</span></span>
      <b>☑ Video</b>
      <span>Resolution &nbsp; <b>1080P</b> ▾</span>
      <span>Bit rate &nbsp; <b>Recommended</b> ▾</span>
      <span>Codec &nbsp; <b>H.264</b> ▾</span>
      <span>Format &nbsp; <b>mp4</b> ▾</span>
      <span>Frame rate &nbsp; <b>30fps</b> ▾</span>
      <b>☐ Audio only</b>
      <span style="justify-self:end;background:#2fd3c5;color:#111;border-radius:5px;padding:5px 16px;font-weight:700">Export</span></div>`),
  pins: [
    [52, 30, '<b>Resolution</b> – ‏1080P. ‏4K לא נחוץ לסרטון לולאה, ובחינם לא תמיד זמין.'],
    [56, 46, '<b>Codec</b> – ‏H.264, הנפוץ ביותר. יוטיוב מקבל אותו בלי בעיה.'],
    [57, 62, '<b>Frame rate</b> – ‏24 או 30. בסרטון רגוע אין צורך ביותר; מספר נמוך גם מקצר את זמן הייצוא.'],
    [78, 88, '<b>Export</b> – שעה של וידאו יכולה לקחת 10–40 דקות, לפי המחשב.']
  ]
});

// --- AdSense: מידע מס ---
MOCK.adsenseTax = () => mock({
  app: 'yt', url: 'adsense.google.com – Payments – Settings', h: 320, wide: true,
  cap: 'AdSense ← Payments ← Payments info ← Manage settings ← United States tax info.',
  body:
    A(0, 0, 100, 12, '', `<div style="background:#f8f9fa;height:100%;display:flex;align-items:center;padding:0 12px;gap:10px"><b>Google AdSense</b><span class="y-dim">Payments › Settings</span></div>`) +
    A(4, 18, 92, 30, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px"><b>United States tax info</b><br><span class="y-dim">Provide your tax info to avoid the highest withholding rate on earnings from US viewers.</span><br><span style="color:#1a73e8;font-weight:600">MANAGE TAX INFO</span></div>`) +
    A(4, 54, 92, 40, '', `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:10px;display:grid;gap:5px"><b>Tax form</b><span>Are you an individual or business? ◉ Individual</span><span>Are you a US citizen? ◉ No</span><span>Form: <b>W-8BEN</b> · Country of residence: Israel</span><span class="y-dim">Claim tax treaty benefits ☑</span></div>`),
  pins: [
    [40, 40, '<b>Manage tax info</b> – בלי טופס, יוטיוב מנכה עד 24% מההכנסה מצופים בארה"ב.'],
    [45, 73, '<b>W-8BEN, אדם פרטי, תושבות ישראל</b> – מילוי נכון מוריד את הניכוי לפי אמנת המס. ממלאים מספר תעודת זהות ישראלי.'],
    [30, 88, '<b>Treaty benefits</b> – מסמנים כדי לקבל את שיעור האמנה. מה בדיוק השיעור – בודקים עם רואה חשבון.']
  ]
});
