// הבריף של הסרטון: מה מצלמים, באיזה אור, באיזה סגנון ובאיזה פורמט. המזהים כפולים ב-web/src/lib/brief.js – לשנות בשניהם (בדיקה מוודאת).
export const KINDS = {
  building: 'a residential building / real-estate project (exterior)',
  apartment: 'an apartment (interior)',
  house: 'a private house / villa',
};

// האור והאווירה של כל הסרטון (אחיד בכל השוטים)
export const LOOKS = {
  golden: 'golden hour: warm low sun, long soft shadows, glowing glass reflections, clear sky with a few thin clouds',
  day: 'bright clear Mediterranean day: crisp blue sky, clean neutral daylight, fresh green landscaping',
  dusk: 'blue-hour dusk: deep blue sky, warm interior lights glowing from the windows, lit landscaping and entrance',
};

// סגנון הסרטון: איך המצלמה זזה ומה הקצב. arc = מבנה ארבעת השוטים (לבמאי), camera = שפת המצלמה (לבמאי),
// pace = משפט הקצב שנכנס לכל הוראת וידאו, calm = האם תנועה מהירה אסורה
export const STYLES = {
  drone: {
    arc: 'everything is seen from a drone: (1) a high wide approach that flies in toward the property, (2) a full sweeping orbit around it, (3) a low fast-feeling fly-by along the facade / over the balconies or roof, (4) a pull-back and rise that reveals the property in its surroundings and holds for a logo',
    camera: 'aerial drone moves only, with real travel distance and strong parallax: fly-in, orbit, fly-over, top-down rising reveal, descending crane-like drop. The foreground (trees, rooftops, street) slides past the camera. Not a timid push-in.',
    pace: 'A confident, sweeping aerial drone shot: the camera travels a long visible distance with strong parallax, smooth and stabilised.',
    calm: false,
  },
  tour: {
    arc: 'a guided walk into the property, each shot continuing where the last ended: (1) arriving from the street toward the entrance, (2) gliding through the entrance / lobby or the front door, (3) moving through the main living space toward the windows or balcony, (4) stepping out to the balcony / view, or turning back for a final wide look that holds for a logo',
    camera: 'a steadicam / gimbal walking forward at eye level, as if a visitor walks in: forward dolly through doorways, gentle turns that reveal the next space, push toward a window and its view. Always moving forward through space.',
    pace: 'A smooth gimbal walkthrough at eye level: the camera glides forward through the space at walking pace, revealing what is ahead.',
    calm: true,
  },
  dynamic: {
    arc: 'an energetic social-media cut: (1) a fast dramatic reveal of the property (rise from behind foreground, or a rapid fly-in that settles), (2) a quick orbit or parallax slide with a strong foreground element, (3) a punchy detail move (fast push to a balcony, entrance, pool or interior highlight), (4) a hero pull-back that lands on a clean wide frame for a logo',
    camera: 'fast, bold, modern moves with speed ramps: rapid fly-in that eases to a stop, quick orbit, low-angle rising reveal, fast push-in, parallax slide behind foreground objects, hyperlapse-style motion. Every shot starts already in motion and ends on a strong composition.',
    pace: 'An energetic, fast and bold camera move with a speed ramp: it starts quick and eases into a strong final composition. Smooth and stabilised, never shaky.',
    calm: false,
  },
  timelapse: {
    arc: 'the passage of a day over the property: (1) early morning light to full day in a wide shot, clouds racing, (2) shadows sweeping across the facade through the day, (3) sunset to dusk as the windows and landscape lights turn on one after another, (4) a night hero shot, fully lit, that holds for a logo',
    camera: 'a locked or very slowly drifting camera while time races: clouds streak across the sky, shadows move, the light changes colour, lights switch on. The drama is the changing light, not the camera.',
    pace: 'A time-lapse: the camera barely drifts while time races, clouds streak across the sky, shadows sweep and the light changes through the shot.',
    calm: true,
  },
  classic: {
    arc: '(1) an establishing hero shot, (2) a move that reveals scale or approaches the entrance, (3) a detail or lifestyle moment (balcony, lobby, living room, view), (4) a closing wide shot that holds still enough for a logo and contact details',
    camera: 'slow, confident, elegant moves: slow aerial push-in, gentle orbit, rising crane shot, slow dolly forward, lateral slider move, slow tilt up.',
    pace: 'One slow, elegant, perfectly stabilised camera move.',
    calm: true,
  },
};

export const ASPECTS = ['16:9', '9:16'];
export const QUALITIES = ['max', 'fast'];
export const SHOTS = 4;

const str = (s, max) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pick = (v, all, def) => (all.includes(v) ? v : def);

// ניקוי הבריף מהלקוח, עם ברירות מחדל
export function cleanBrief(b) {
  return {
    kind: pick(b?.kind, Object.keys(KINDS), 'building'),
    look: pick(b?.look, Object.keys(LOOKS), 'golden'),
    aspect: pick(b?.aspect, ASPECTS, '16:9'),
    // בריף ישן בלי סגנון = הסגנון שהיה אז (קלאסי)
    style: pick(b?.style, Object.keys(STYLES), 'classic'),
    name: str(b?.name, 80),
    note: str(b?.note, 600),
  };
}
