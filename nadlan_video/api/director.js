// הבמאי: Claude מסתכל על הצילום ו/או השרטוט וכותב רשימת שוטים לסרטון תדמית.
// לכל שוט: כותרת והסבר בעברית + הוראה באנגלית לפריים הפתיחה (מחולל התמונות) + הוראה באנגלית לתנועת המצלמה (Veo).
import { KINDS, LOOKS, SHOTS } from './brief.js';

export const MODEL = 'claude-opus-5-5';

export const PLAN_TOOL = {
  name: 'shot_list',
  description: 'Give the real-estate marketer your read of the property and the shot list for the promo film.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Hebrew, 1-2 sentences: what you see in the material (building type, floors, style, or the apartment layout) and the idea of the film' },
      shots: {
        type: 'array',
        description: `Exactly ${SHOTS} shots, in the order they appear in the film`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew, 2-4 words' },
            why: { type: 'string', description: 'Hebrew, one sentence: what the viewer sees and feels in this shot' },
            source: { type: 'string', enum: ['photo', 'plan'], description: 'Which supplied image the opening frame is built from' },
            still: {
              type: 'string',
              description: 'English instruction for an image model that receives the source image and must return the photorealistic opening frame of this shot. Empty string ONLY when the source photo itself is already a finished, photorealistic, well-composed frame that should be used untouched.',
            },
            motion: { type: 'string', description: 'English prompt for an image-to-video model: one continuous camera move starting from the opening frame, plus the living details in the scene and the ambient sound' },
          },
          required: ['title', 'why', 'source', 'still', 'motion'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'shots'],
    additionalProperties: false,
  },
};

export function planSystem(brief, has) {
  const material = [has.photo && 'a PHOTO (a real photograph or an existing render of the property)', has.plan && 'a PLAN (an architectural drawing: floor plan, elevation, section or sketch)'].filter(Boolean).join(' and ');
  return `You are the director of high-end real-estate promotional films, the kind top developers in Israel use to launch \
a luxury project: slow, confident camera moves, perfect light, architecture shown truthfully and at its best.

A real-estate marketer sends you ${material} of ${KINDS[brief.kind]}. You plan a film of exactly ${SHOTS} shots, 8 seconds \
each. For every shot an image model first produces a photorealistic opening frame from one of the supplied images, and an \
image-to-video model (Google Veo) then animates that frame with one camera move.

The film has an arc: (1) an establishing hero shot, (2) a move that reveals scale or approaches the entrance, (3) a detail \
or lifestyle moment (balcony, lobby, living room, view), (4) a closing wide shot that holds still enough for a logo and \
contact details. All shots share the same light: ${LOOKS[brief.look]}.

Truthfulness is the first rule. This film sells a real property, so never invent what the material does not show: keep \
the exact number of floors, the facade composition, window and balcony layout, materials and colours of a photographed \
building; keep the exact room layout, proportions, doors and windows of a floor plan. You may dress the scene (landscaping, \
sky, light, tasteful furniture, parked cars far away) but not change the architecture.

Writing "still" (the opening frame):
- From a PLAN of a building (elevation / sketch): ask for a photorealistic architectural visualisation of exactly this \
building, naming the camera position (eye-level street view, three-quarter aerial, entrance close-up), lens, materials you \
read from the drawing, surroundings and the light.
- From a floor PLAN of an apartment: each shot is one room or area that exists in the plan. Describe that room as seen by \
a camera standing inside it at eye level: which walls, windows, doors and openings are where (read them from the plan), \
contemporary high-end Israeli interior, real furniture at correct scale, the light. Say explicitly that it must be a \
photograph-like interior view, not a top-down plan.
- From a PHOTO: for the hero shot prefer the photo itself, cleaned and relit (remove clutter, cranes, wires, signs and \
people; set the light), same camera angle. For other shots you may ask for a new camera position of the same building \
(closer on the entrance, an upper balcony, higher three-quarter aerial) while keeping its design identical.
- Always end with: photorealistic, shot on a full-frame cinema camera, natural colours, no text, no logos, no watermark, \
no people in the foreground. State the frame orientation: ${brief.aspect === '9:16' ? 'vertical 9:16' : 'horizontal 16:9'}.

Writing "motion" (the video prompt): one slow, smooth, stabilised move per shot, with the exact vocabulary of \
cinematography: slow aerial drone push-in, gentle orbit to the right, rising crane shot, slow dolly forward through the \
room, lateral slider move, slow tilt up. Never cuts, never fast moves, never zoom bursts. Add small living details that \
make it feel real (leaves moving in a light breeze, clouds drifting, curtains breathing, reflections sliding on glass, \
lights turning on at dusk). State that the building / room geometry stays rigid and unchanged, straight verticals, no \
morphing, no new objects appearing. End with the sound: subtle natural ambience only (light breeze, distant birds, soft \
room tone), no music, no speech.

Write "summary", "title" and "why" in natural, simple Israeli Hebrew. Write "still" and "motion" in English. If the \
marketer added a note, follow it. Always finish by calling shot_list.`;
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// שגיאות מ-Anthropic בעברית
export function aiMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (/credit balance|billing|purchase credits/.test(t)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(t)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'הבמאי לא הצליח לענות. נסו שוב.';
}

// התשובה של Claude -> { summary, shots } נקי, או null. שוט שמבוסס על תמונה שלא נשלחה עובר לתמונה שכן נשלחה
export function readPlan(input, has) {
  const only = has.photo ? 'photo' : 'plan';
  const shots = (Array.isArray(input?.shots) ? input.shots : [])
    .map((s) => {
      const source = (s?.source === 'plan' && has.plan) || (s?.source === 'photo' && has.photo) ? s.source : only;
      let still = clean(s?.still, 2500);
      // שרטוט לעולם לא הופך לסרטון כמו שהוא – חייב פריים פוטוריאליסטי
      if (!still && source === 'plan') still = 'Turn this architectural drawing into a photorealistic architectural visualisation of exactly this design, eye-level view, natural light, no text.';
      return { title: clean(s?.title, 60), why: clean(s?.why, 300), source, still, motion: clean(s?.motion, 2500) };
    })
    .filter((s) => s.title && s.motion)
    .slice(0, SHOTS);
  if (!shots.length) return null;
  return { summary: clean(input?.summary, 500), shots };
}

const imagePart = (im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });

// brief: מ-cleanBrief. images: { photo?, plan? }. מחזיר { summary, shots } או זורק Error בעברית
export async function planFilm(env, brief, images) {
  const has = { photo: Boolean(images.photo), plan: Boolean(images.plan) };
  const content = [];
  if (has.photo) content.push({ type: 'text', text: 'PHOTO:' }, imagePart(images.photo));
  if (has.plan) content.push({ type: 'text', text: 'PLAN:' }, imagePart(images.plan));
  content.push({ type: 'text', text: `${brief.name ? `Project name: ${brief.name}\n` : ''}${brief.note ? `Note from the marketer (may be in Hebrew): ${brief.note}\n` : ''}Plan the film.` });
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // אם המודל מסרב – השרת של Anthropic מנסה לבד מודל אחר
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL, fallbacks: 'default', max_tokens: 6000, system: planSystem(brief, has),
        tools: [PLAN_TOOL], tool_choice: { type: 'tool', name: PLAN_TOOL.name }, messages: [{ role: 'user', content }],
      }),
    });
  } catch {
    throw new Error('אין חיבור לבמאי כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (!res.ok) {
    const e = new Error(aiMessage(res.status, raw));
    let msg = '';
    try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
    e.detail = `${res.status} ${MODEL}: ${String(msg || raw).replace(/\s+/g, ' ').slice(0, 300)}`;
    throw e;
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('הבמאי לא הצליח לענות. נסו שוב.'); }
  const use = (data.content || []).find((b) => b.type === 'tool_use' && b.name === PLAN_TOOL.name);
  const plan = readPlan(use?.input, has);
  if (!plan) throw new Error('הבמאי לא הצליח לבנות רשימת שוטים. נסו שוב, או העלו תמונה ברורה יותר.');
  return plan;
}
