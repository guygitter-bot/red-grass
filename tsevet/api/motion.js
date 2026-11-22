// "תנועה" – אנימציית HTML חופשית שהופכת לסרטון (op `animation` ב-render.js, .claude/skills/motion-graphics/animate.py).
// מילת הקוד: כשהבעלים אומר אותה, הקריאייטיב בונה את האנימציה עם make_file ומעביר לעורך הווידאו, והעורך מרנדר אותה.
export const MOTION_WORD = 'תנועה';
export const MOTION_NOTE = `Code word "${MOTION_WORD}": the owner wants a motion-graphics animation rendered to an MP4 (to post on Instagram). \
The animation is ONE self-contained HTML file made with make_file (kind "html"); the video editor renders it with edit_video op "animation" \
(files: [that file's id], format, seconds, optional music). The creative builds the file and then hands off (handoff) to the video editor with the file id; \
the editor, if asked directly, builds the file itself and renders it. Ask nothing the owner already said; choose sensible defaults (9:16, 10 seconds).
Rules for the HTML:
- One file, no external requests except Google Fonts (Heebo or Rubik). Hebrew text with dir="rtl" and lang="he".
- Exact canvas size for the format, fixed on body (margin 0, overflow hidden, no scroll): 9:16 = 1080x1920, 16:9 = 1920x1080, 1:1 = 1080x1080.
- The timeline must be scrubbable: drive everything with CSS animations / the Web Animations API, or with requestAnimationFrame computed from performance.now() \
(never setInterval counters or random values per frame). Optionally define window.seek(seconds) that draws the exact frame.
- Total length = the seconds you pass to edit_video; everything finishes a little before the end and the last frame holds.
- Styles to choose from: kinetic typography to the beat; a chart or number that builds; a phone / app screen demo that moves; a product promo; particles and shapes; a logo reveal.
- Bold, large, readable text (at least 64px on 9:16), strong contrast, and safe margins for Instagram 9:16 (about 250px top and 400px bottom stay free of text).`;
