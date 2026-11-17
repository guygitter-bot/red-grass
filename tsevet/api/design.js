// סקיל העיצוב של הצוות – קבוע (לא מהמאגר ולא מ-GitHub), תמיד פעיל אצל 🎨 קריאייטיב ו-👨‍💻 המתכנת.
// נכנס להנחיות כסקיל מותקן (הטקסט המלא), כך שכל דף נחיתה, איור או תמונה שהם יוצרים נבנה לפיו.
export const DESIGNERS = ['creative', 'coder'];

export const DESIGN_SKILL = {
  name: 'design-system',
  title: 'עיצוב מקצועי – דפי נחיתה, איורים ותמונות',
  when: 'every landing page, html/svg file, image prompt or visual you create',
  body: `Work like a senior product designer. Before building, decide in one line: the goal of the page, the audience, and the ONE action you want (e.g. "install the app").

Landing page structure (mobile first, one column on the phone, max-width ~1100px on desktop):
1. Hero: a clear benefit headline (max ~8 words, not the app name alone), one supporting line, ONE primary button, and a visual (product screenshot / generated image) – all visible without scrolling on a phone.
2. Social proof or the problem in the user's words.
3. 3 benefits (not features): icon or small image + short title + one sentence each.
4. How it works: 3 short steps.
5. Objections / FAQ (3–5).
6. Final call to action repeating the primary button. Footer: name, contact, privacy.
Cut anything that does not serve the one action.

Hebrew and RTL:
- <html lang="he" dir="rtl">. Logical CSS (margin-inline-start, padding-inline, text-align: start). Icons that point (arrows) are mirrored.
- Fonts: Google Fonts "Rubik" or "Heebo" (+ system-ui fallback). Numbers and English inside Hebrew: wrap in <bdi> or dir="ltr" when they flip.
- Write real, specific Hebrew copy – short sentences, speak to the user ("את/ה"), no lorem ipsum, no buzzwords.

Visual system (define as CSS variables in :root and reuse):
- Color: one brand color + one accent at most, neutrals for text and backgrounds. Text contrast ≥ 4.5:1 (WCAG AA). Use the app's existing brand colors when known.
- Type scale: 14/16/20/24/32/40px (clamp() for headlines), line-height 1.5 for body, 1.15 for headlines, max ~65 characters per line.
- Spacing: 4/8/12/16/24/32/48/64px only. Generous whitespace; sections 48–96px apart.
- Radius 12–16px, soft shadows (0 8px 24px rgb(0 0 0 / .08)), consistent everywhere.
- Buttons: min height 44px, clear label with a verb ("להתחיל בחינם"), hover/focus states, visible focus ring.
- Dark mode: @media (prefers-color-scheme: dark) with its own background/text variables.

Quality bar:
- One self-contained HTML file: inline CSS, no frameworks, minimal JS, semantic tags (header/main/section/footer), alt text on images, <meta name="viewport">.
- Images: max-width:100%, height:auto, loading="lazy" (except the hero), object-fit for crops.
- Check at 375px and 1280px widths in your head: nothing overflows, tap targets ≥ 44px, no tiny text (< 14px).

Images (make_image prompts – in English):
- Describe subject, setting, composition, camera/angle, light, color palette matching the brand, mood, and style (photo / 3D / flat illustration). Say what must NOT appear (text, logos, extra fingers, clutter).
- Hebrew text inside a generated image is unreliable – put text in the HTML/SVG instead, or keep it to 1–3 words and spell it exactly.
- Aspect: 16:9 or 4:3 for hero on desktop, 4:5 or 9:16 for phone/social, 1:1 for icons/cards.

SVG illustrations: viewBox, flat shapes, the brand palette, no embedded fonts for important text (or simple text with font-family fallback), aria-label/title.

Before sending: re-read the copy once for clarity and typos, make sure the main button is obvious, and tell the owner in one line what you made and what to check.`,
};

export const designSkills = (agent) => (DESIGNERS.includes(agent) ? [DESIGN_SKILL] : []);
